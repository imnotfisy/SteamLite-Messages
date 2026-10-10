package com.steamlite.messages;

import android.app.RemoteInput;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import org.json.JSONObject;

/** Sends what you typed into a notification's reply box. */
public class ReplyReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(final Context c, final Intent i) {
        Bundle in = RemoteInput.getResultsFromIntent(i);
        final String conv = i.getStringExtra("conv"), title = i.getStringExtra("title");
        final CharSequence cs = in == null ? null : in.getCharSequence("reply");
        if (cs == null || conv == null) return;
        final String text = cs.toString().trim(); if (text.isEmpty()) return;
        final PendingResult pr = goAsync();
        new Thread(() -> {
            try {
                String tok = c.getSharedPreferences("sl", Context.MODE_PRIVATE).getString("token", "");
                if (!tok.isEmpty()) {
                    JSONObject h = new JSONObject(); h.put("Authorization", "Bearer " + tok); h.put("Content-Type", "application/json");
                    JSONObject b = new JSONObject(); b.put("conv", conv); b.put("text", text);
                    Object[] r = Net.call("POST", Net.BASE + "/social/send", h, b.toString());
                    Notify.channels(c);
                    if ((Integer) r[0] == 200) Notify.message(c, conv, title == null ? "SteamLite" : title, "", text, true);
                    else Notify.message(c, conv, title == null ? "SteamLite" : title, "SteamLite", "Could not send your reply. Open the app to try again.", false);
                }
            } catch (Exception e) { }
            pr.finish();
        }).start();
    }
}
