package com.steamlite.messages;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Checks for new messages every ~15 minutes while the app is closed and shows a notification.
 * (Android does not allow background checks to run more often than that.)
 */
public class PollService extends JobService {
    static final int JOB_ID = 4202;   // 4201 was the old 15-minute job
    static final String CHANNEL = "messages";

    static void schedule(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        js.cancel(4201);
        for (JobInfo j : js.getAllPendingJobs()) if (j.getId() == JOB_ID) return;
        js.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(c, PollService.class))
                .setPeriodic(30 * 60 * 1000L)   // push (Firebase) delivers messages instantly; this is only the backup
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setRequiresBatteryNotLow(true)
                .setPersisted(true)
                .build());
    }

    static void cancel(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.cancel(JOB_ID);
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Messages", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("New messages and friend requests");
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public boolean onStartJob(final JobParameters p) {
        new Thread(() -> { try { check(getApplicationContext()); } catch (Exception e) { } jobFinished(p, false); }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters p) { return true; }

    static void check(Context c) throws Exception {
        SharedPreferences sp = c.getSharedPreferences("sl", Context.MODE_PRIVATE);
        String tok = sp.getString("token", "");
        if (tok.isEmpty() || sp.getBoolean("muteAll", false) || MainActivity.foreground || sp.getBoolean("pushOn", false)) return;   // while push works this is not needed
        JSONObject h = new JSONObject(); h.put("Authorization", "Bearer " + tok);
        Object[] r = Net.call("GET", Net.BASE + "/social/overview", h, null);
        int code = (Integer) r[0];
        if (code == 401) { sp.edit().putString("token", "").apply(); return; }
        if (code != 200) return;
        JSONObject o = new JSONObject((String) r[1]);
        Notify.channels(c);
        SharedPreferences.Editor ed = sp.edit();
        int shown = 0;
        JSONArray convs = o.optJSONArray("convs");
        if (convs != null) for (int i = 0; i < convs.length() && shown < 5; i++) {
            JSONObject cv = convs.getJSONObject(i);
            if (cv.optInt("unread") <= 0 || cv.optBoolean("muted")) continue;
            String id = cv.getString("id"); long at = cv.optLong("at");
            if (at <= sp.getLong("n_" + id, 0)) continue;
            ed.putLong("n_" + id, at);
            JSONObject last = cv.optJSONObject("last");
            String text = last != null ? last.optString("text") : "New message";
            String from = last != null ? last.optString("from") : "";
            String title = cv.optString("name", "SteamLite");
            if ("group".equals(cv.optString("kind")) && !from.isEmpty()) text = from + ": " + text;
            int n = cv.optInt("unread");
            if (n > 1) text = text + "  (" + n + " new)";
            Notify.message(c, id, title, from.isEmpty() ? title : from, text, false);
            shown++;
        }
        JSONArray inc = o.optJSONArray("incoming");
        int cnt = inc != null ? inc.length() : 0;
        if (cnt > sp.getInt("n_req", 0)) { java.util.Map<String, String> m = new java.util.HashMap<>(); m.put("t", "friend"); m.put("title", "Friend request"); m.put("body", cnt == 1 ? inc.getJSONObject(0).optString("name") + " wants to be your friend" : cnt + " people want to be your friend"); Notify.show(c, m); }
        ed.putInt("n_req", cnt);
        ed.apply();
        UnreadWidget.set(c, o.optInt("unread"), shownTitle(convs), shownText(convs));
    }

    private static String shownTitle(JSONArray convs) { try { for (int i = 0; convs != null && i < convs.length(); i++) { JSONObject cv = convs.getJSONObject(i); if (cv.optInt("unread") > 0) return cv.optString("name"); } } catch (Exception e) { } return ""; }

    private static String shownText(JSONArray convs) { try { for (int i = 0; convs != null && i < convs.length(); i++) { JSONObject cv = convs.getJSONObject(i); if (cv.optInt("unread") > 0 && cv.optJSONObject("last") != null) return cv.getJSONObject("last").optString("text"); } } catch (Exception e) { } return ""; }

    static void notify(Context c, int id, String title, String text, String target) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("open", target);
        PendingIntent pi = PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(pi).setAutoCancel(true).setColor(0xff8b5cf6).setCategory(Notification.CATEGORY_MESSAGE).setWhen(System.currentTimeMillis());
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH);
        try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(id, b.build()); } catch (Exception e) { }
    }
}
