package com.steamlite.messages;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** The Decline button on an incoming-call notification: tells the server without opening the app. */
public class CallReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(final Context c, final Intent i) {
        final String cid = i.getStringExtra("cid"); if (cid == null) return;
        try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(Notify.callNotifId(cid)); } catch (Exception e) { }
        final PendingResult pr = goAsync();
        new Thread(() -> {
            try {
                String tok = c.getSharedPreferences("sl", Context.MODE_PRIVATE).getString("token", "");
                if (!tok.isEmpty()) {
                    JSONObject h = new JSONObject(); h.put("Authorization", "Bearer " + tok); h.put("Content-Type", "application/json");
                    JSONObject b = new JSONObject(); b.put("id", cid);
                    Net.call("POST", Net.BASE + "/social/call/end", h, b.toString());
                }
            } catch (Exception e) { }
            pr.finish();
        }).start();
    }
}
