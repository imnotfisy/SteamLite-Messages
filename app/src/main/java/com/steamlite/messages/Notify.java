package com.steamlite.messages;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.drawable.Icon;
import android.os.Build;

import org.json.JSONArray;

import java.util.Map;

/** Builds the notifications: chat messages (with a reply box), friend requests, reactions and streak reminders. */
final class Notify {
    static final String MSG = "messages", ACT = "activity", QUIET = "quiet", CALL = "calls", CALLON = "callon";
    /** The sound pack picked in Settings (glass, classic, arcade, crystal, deep, or system for the phone's own sounds). */
    /** Bump this when the sound files change: a channel keeps the sound it was created with, so new sounds need new channels. */
    static final String CHV = "_2";
    static String pack(Context c) { return c.getSharedPreferences("sl", Context.MODE_PRIVATE).getString("pack", "glass"); }
    static android.net.Uri soundUri(Context c, String pack, String kind) {
        if (c.getResources().getIdentifier("snd_" + pack + "_" + kind, "raw", c.getPackageName()) == 0) return null;
        return android.net.Uri.parse("android.resource://" + c.getPackageName() + "/raw/snd_" + pack + "_" + kind);   // by name: a number could change when the app is updated
    }
    /** The channel for a kind of notification (msg, act, ring) with the chosen pack's sound; a channel's sound cannot change later, so each pack gets its own. */
    static String chan(Context c, String kind) {
        String pack = pack(c); android.net.Uri u = "system".equals(pack) ? null : soundUri(c, pack, kind);
        String def = "msg".equals(kind) ? MSG : "ring".equals(kind) ? CALL : ACT;
        if (u == null || Build.VERSION.SDK_INT < 26) return def;
        String id = kind + "_" + pack + CHV, label = pack.substring(0, 1).toUpperCase() + pack.substring(1);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(id) == null) {
            boolean ring = "ring".equals(kind);
            NotificationChannel ch = new NotificationChannel(id, ("msg".equals(kind) ? "Messages" : ring ? "Incoming calls" : "Friends and reminders") + " (" + label + ")", ring || "msg".equals(kind) ? NotificationManager.IMPORTANCE_HIGH : NotificationManager.IMPORTANCE_DEFAULT);
            ch.setSound(u, new android.media.AudioAttributes.Builder().setUsage(ring ? android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE : android.media.AudioAttributes.USAGE_NOTIFICATION).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            if (ring) { ch.enableVibration(true); ch.setVibrationPattern(new long[]{0, 700, 400, 700, 400, 700}); ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC); }
            nm.createNotificationChannel(ch);
        }
        return id;
    }
    /** After the pack changes, the channels of the other packs are removed so the phone's notification settings stay tidy. */
    static void pruneChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); String pack = pack(c);
        for (NotificationChannel ch : nm.getNotificationChannels()) { String id = ch.getId(); if ((id.startsWith("msg_") || id.startsWith("act_") || id.startsWith("ring_")) && !id.endsWith("_" + pack + CHV)) nm.deleteNotificationChannel(id); }
    }
    static int callNotifId(String cid) { return ("call" + cid).hashCode(); }

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(MSG) == null) {
            NotificationChannel ch = new NotificationChannel(MSG, "Messages", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("New chat messages"); nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(QUIET) == null) {
            NotificationChannel ch = new NotificationChannel(QUIET, "Quiet hours", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Notifications that arrive during your Do Not Disturb hours: no sound or buzz"); ch.setSound(null, null); ch.enableVibration(false); nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CALL) == null) {
            NotificationChannel ch = new NotificationChannel(CALL, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Rings when someone calls you"); ch.setSound(android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE), new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            ch.enableVibration(true); ch.setVibrationPattern(new long[]{0, 700, 400, 700, 400, 700}); ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC); nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CALLON) == null) {
            NotificationChannel ch = new NotificationChannel(CALLON, "Ongoing call", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Shown while you are on a call"); ch.setSound(null, null); ch.enableVibration(false); nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(ACT) == null) {
            NotificationChannel ch = new NotificationChannel(ACT, "Friends and reminders", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Friend requests, reactions and streak reminders"); nm.createNotificationChannel(ch);
        }
    }

    private static Notification.Builder builder(Context c, String channel) {
        return Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, channel) : new Notification.Builder(c);
    }

    private static PendingIntent open(Context c, int id, String target) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("open", target);
        return PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void post(Context c, int id, Notification n) {
        SharedPreferences sp = c.getSharedPreferences("sl", Context.MODE_PRIVATE);
        try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(id, n); sp.edit().putLong("lastShownAt", System.currentTimeMillis()).apply(); } catch (Throwable e) { sp.edit().putString("lastPushErr", "Could not show it: " + e.getClass().getSimpleName() + " " + e.getMessage()).apply(); }
    }

    /** Is this kind of notification switched on in Settings? (messages, friend, react, deal, streak; tests always show) */
    static boolean wanted(SharedPreferences sp, String t) {
        if ("test".equals(t)) return true;
        try { org.json.JSONObject o = new org.json.JSONObject(sp.getString("ntypes", "{}")); return o.optBoolean(t, true); } catch (Exception e) { return true; }
    }

    /** Inside the Do Not Disturb hours set in Settings? (the window may cross midnight) */
    static boolean quietNow(SharedPreferences sp) {
        if (!sp.getBoolean("dndOn", false)) return false;
        java.util.Calendar cal = java.util.Calendar.getInstance(); int now = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE), from = sp.getInt("dndFrom", 1320), to = sp.getInt("dndTo", 480);
        return from <= to ? (now >= from && now < to) : (now >= from || now < to);
    }

    /** Shows whatever the server (or the background check) sent. */
    static void show(Context c, Map<String, String> d) {
        SharedPreferences sp = c.getSharedPreferences("sl", Context.MODE_PRIVATE);
        String t0 = String.valueOf(d.get("t"));
        if ("callend".equals(t0)) { String cid = d.get("cid"); if (cid != null) { try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(callNotifId(cid)); } catch (Exception e) { } MainActivity.jsGlobal("window.callEnded&&callEnded(" + org.json.JSONObject.quote(cid) + ")"); } return; }
        if ("call".equals(t0)) { if (d.get("cid") != null) incomingCall(c, d); return; }
        if (sp.getBoolean("muteAll", false)) { sp.edit().putString("lastPushErr", "Skipped: notifications are switched off inside SteamLite (Me tab).").apply(); return; }
        if (MainActivity.foreground && !"test".equals(t0)) { sp.edit().putString("lastPushErr", "Skipped: the app was open, so it shows the message on screen instead.").apply(); return; }   // a test is shown even while the app is open
        if (!wanted(sp, t0)) { sp.edit().putString("lastPushErr", "Skipped: you turned off this kind of notification in Settings.").apply(); return; }
        channels(c);
        String t = String.valueOf(d.get("t")), title = d.get("title") == null ? "SteamLite" : d.get("title"), body = d.get("body") == null ? "" : d.get("body"), conv = d.get("conv");
        if ("msg".equals(t) && conv != null && !conv.isEmpty()) { message(c, conv, title, d.get("sender") != null ? d.get("sender") : d.get("from") == null ? title : d.get("from"), body, false); UnreadWidget.bump(c, title, body); return; }
        String target = "react".equals(t) && conv != null ? conv : ("deal".equals(t) || "free".equals(t)) ? "game:" + d.get("appid") : "#friends";
        int id = "friend".equals(t) ? 77 : "streak".equals(t) ? 78 : "deal".equals(t) ? 79 : "free".equals(t) ? 80 : ("react" + conv).hashCode();
        Notification.Builder b = builder(c, quietNow(sp) ? QUIET : chan(c, "act")).setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(open(c, id, target)).setAutoCancel(true).setColor(0xff8b5cf6).setWhen(System.currentTimeMillis());
        post(c, id, b.build());
    }

    /** A ringing notification with Answer and Decline; it opens over the lock screen. When the app is already open the page shows its own call screen. */
    static void incomingCall(Context c, Map<String, String> d) {
        if (MainActivity.foreground) { MainActivity.jsGlobal("window.pollCall&&pollCall()"); return; }
        channels(c);
        String cid = d.get("cid"), title = d.get("title") == null ? "SteamLite" : d.get("title"); boolean video = "1".equals(d.get("video"));
        int id = callNotifId(cid);
        PendingIntent tap = open(c, id, "call:" + cid), answer = open(c, id + 1, "call:" + cid + ":accept");
        PendingIntent decl = PendingIntent.getBroadcast(c, id, new Intent(c, CallReceiver.class).putExtra("cid", cid), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = builder(c, chan(c, "ring")).setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(video ? "Incoming video call" : "Incoming voice call").setContentIntent(tap).setFullScreenIntent(tap, true)
                .setCategory(Notification.CATEGORY_CALL).setOngoing(true).setAutoCancel(true).setColor(0xff8b5cf6).setWhen(System.currentTimeMillis())
                .addAction(new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_stat), "Decline", decl).build())
                .addAction(new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_stat), "Answer", answer).build());
        if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(45000);
        else { b.setPriority(Notification.PRIORITY_MAX); b.setSound(android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE)); b.setVibrate(new long[]{0, 700, 400, 700}); }
        Notification n = b.build(); n.flags |= Notification.FLAG_INSISTENT;
        post(c, id, n);
    }

    /** The always-visible notification while a call is going on (it is what lets the microphone keep working with the screen off). */
    static Notification ongoingCall(Context c, String name, boolean video) {
        channels(c);
        return builder(c, CALLON).setSmallIcon(R.drawable.ic_stat).setContentTitle((video ? "Video call" : "Voice call") + (name.isEmpty() ? "" : " with " + name)).setContentText("Tap to return to the call")
                .setContentIntent(open(c, 4243, "")).setOngoing(true).setColor(0xff8b5cf6).setCategory(Notification.CATEGORY_CALL).setUsesChronometer(true).setWhen(System.currentTimeMillis()).build();
    }

    /** A chat notification that remembers the last few messages and has a reply box. */
    static void message(Context c, String conv, String title, String from, String text, boolean mine) {
        SharedPreferences sp = c.getSharedPreferences("sl", Context.MODE_PRIVATE);
        JSONArray h; try { h = new JSONArray(sp.getString("h_" + conv, "[]")); } catch (Exception e) { h = new JSONArray(); }
        try { JSONArray row = new JSONArray(); row.put(mine ? "" : from).put(text).put(System.currentTimeMillis()); h.put(row); } catch (Exception e) { }
        JSONArray cut = new JSONArray(); try { for (int i = Math.max(0, h.length() - 6); i < h.length(); i++) cut.put(h.get(i)); } catch (Exception e) { }
        sp.edit().putString("h_" + conv, cut.toString()).apply();
        int id = conv.hashCode();
        Notification.MessagingStyle st = new Notification.MessagingStyle("Me");
        st.setConversationTitle(title);
        try { for (int i = 0; i < cut.length(); i++) { JSONArray r = cut.getJSONArray(i); String who = r.getString(0); st.addMessage(r.getString(1), r.getLong(2), who.isEmpty() ? null : who); } } catch (Exception e) { }
        RemoteInput ri = new RemoteInput.Builder("reply").setLabel("Reply").build();
        Intent ri2 = new Intent(c, ReplyReceiver.class).putExtra("conv", conv).putExtra("title", title);
        PendingIntent rp = PendingIntent.getBroadcast(c, id, ri2, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
        Notification.Action act = new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_stat), "Reply", rp).addRemoteInput(ri).build();
        Notification.Builder b = builder(c, quietNow(sp) ? QUIET : chan(c, "msg")).setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(text).setStyle(st).addAction(act)
                .setContentIntent(open(c, id, conv)).setAutoCancel(true).setColor(0xff8b5cf6).setCategory(Notification.CATEGORY_MESSAGE).setWhen(System.currentTimeMillis()).setOnlyAlertOnce(mine);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH);
        post(c, id, b.build());
    }

    static void clearHistory(Context c) {
        SharedPreferences sp = c.getSharedPreferences("sl", Context.MODE_PRIVATE); SharedPreferences.Editor ed = sp.edit();
        for (String k : sp.getAll().keySet()) if (k.startsWith("h_")) ed.remove(k);
        ed.apply();
    }
}
