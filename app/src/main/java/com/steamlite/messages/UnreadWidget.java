package com.steamlite.messages;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** Home-screen widget: how many unread messages you have and the latest one. */
public class UnreadWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) draw(c, m, id); }

    static void draw(Context c, AppWidgetManager m, int id) {
        SharedPreferences sp = c.getSharedPreferences("sl", Context.MODE_PRIVATE);
        boolean signedIn = !sp.getString("token", "").isEmpty();
        int n = sp.getInt("w_unread", 0);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_unread);
        v.setTextViewText(R.id.w_count, !signedIn ? "-" : String.valueOf(n));
        v.setTextViewText(R.id.w_label, !signedIn ? "Open SteamLite to sign in" : n == 1 ? "unread message" : "unread messages");
        v.setTextViewText(R.id.w_text, !signedIn ? "" : n > 0 ? sp.getString("w_title", "") + ": " + sp.getString("w_text", "") : "You are all caught up");
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        m.updateAppWidget(id, v);
    }

    static void refresh(Context c) {
        try { AppWidgetManager m = AppWidgetManager.getInstance(c); for (int id : m.getAppWidgetIds(new ComponentName(c, UnreadWidget.class))) draw(c, m, id); } catch (Exception e) { }
    }

    /** The app tells the widget the real numbers. */
    static void set(Context c, int unread, String title, String text) {
        c.getSharedPreferences("sl", Context.MODE_PRIVATE).edit().putInt("w_unread", unread).putString("w_title", title).putString("w_text", text).apply(); refresh(c);
    }

    /** A push arrived while the app was closed: one more unread. */
    static void bump(Context c, String title, String text) {
        SharedPreferences sp = c.getSharedPreferences("sl", Context.MODE_PRIVATE);
        set(c, sp.getInt("w_unread", 0) + 1, title, text);
    }
}
