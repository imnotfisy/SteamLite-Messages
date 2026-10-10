package com.steamlite.messages;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** Home-screen widget: your play streak and whether today is done. */
public class StreakWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) draw(c, m, id); }

    static void draw(Context c, AppWidgetManager m, int id) {
        SharedPreferences sp = c.getSharedPreferences("sl", Context.MODE_PRIVATE);
        boolean signedIn = !sp.getString("token", "").isEmpty();
        int days = sp.getInt("sw_days", 0); boolean done = sp.getBoolean("sw_done", false);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_streak);
        v.setTextViewText(R.id.s_count, !signedIn ? "-" : String.valueOf(days));
        v.setTextViewText(R.id.s_label, !signedIn ? "Open SteamLite to sign in" : days == 0 ? "Start a streak today" : done ? "day streak - done today" : "Message anyone to keep it");
        v.setTextColor(R.id.s_count, done || days == 0 ? 0xFFFF9D2E : 0xFFFF5A4D);
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("open", "#tab:home");
        v.setOnClickPendingIntent(R.id.s_root, PendingIntent.getActivity(c, 2, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        m.updateAppWidget(id, v);
    }

    static void set(Context c, int days, boolean done) {
        c.getSharedPreferences("sl", Context.MODE_PRIVATE).edit().putInt("sw_days", days).putBoolean("sw_done", done).apply();
        try { AppWidgetManager m = AppWidgetManager.getInstance(c); for (int id : m.getAppWidgetIds(new ComponentName(c, StreakWidget.class))) draw(c, m, id); } catch (Exception e) { }
    }
}
