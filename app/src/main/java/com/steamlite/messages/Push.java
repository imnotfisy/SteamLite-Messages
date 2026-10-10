package com.steamlite.messages;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

/** Tells SteamLite Online which phone to send push messages to. While push works, the 15-minute background check is not needed. */
final class Push {
    /** Asks Firebase for this phone's address and registers it, if signed in. */
    static void start(final Context c) {
        try {
            final SharedPreferences sp = c.getSharedPreferences("sl", Context.MODE_PRIVATE);
            App.ensureFirebase(c);
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(t -> register(c, t)).addOnFailureListener(e -> sp.edit().putString("pushErr", "Google could not give this phone a push address: " + String.valueOf(e.getMessage())).apply());
        } catch (Exception e) { }
    }

    static void register(final Context c, final String fcm) {
        final SharedPreferences sp = c.getSharedPreferences("sl", Context.MODE_PRIVATE);
        sp.edit().putString("fcm", fcm).apply();
        final String tok = sp.getString("token", "");
        if (tok.isEmpty() || fcm == null) return;
        new Thread(() -> {
            try {
                JSONObject h = new JSONObject(); h.put("Authorization", "Bearer " + tok); h.put("Content-Type", "application/json");
                JSONObject b = new JSONObject(); b.put("token", fcm); b.put("app", "messages");
                Object[] r = Net.call("POST", Net.BASE + "/push/register", h, b.toString());
                if ((Integer) r[0] == 200 && new JSONObject((String) r[1]).optBoolean("enabled")) { sp.edit().putBoolean("pushOn", true).remove("pushErr").apply(); PollService.cancel(c); }
                else sp.edit().putBoolean("pushOn", false).putString("pushErr", (Integer) r[0] == 0 ? "The phone could not reach SteamLite Online." : "SteamLite Online answered " + r[0] + " when registering this phone.").apply();
            } catch (Exception e) { }
        }).start();
    }

    /** Called when someone signs out: stop sending this phone their messages. */
    static void unregister(final Context c, final String oldToken) {
        final SharedPreferences sp = c.getSharedPreferences("sl", Context.MODE_PRIVATE);
        final String fcm = sp.getString("fcm", "");
        sp.edit().putBoolean("pushOn", false).apply();
        if (fcm.isEmpty() || oldToken == null || oldToken.isEmpty()) return;
        new Thread(() -> {
            try {
                JSONObject h = new JSONObject(); h.put("Authorization", "Bearer " + oldToken); h.put("Content-Type", "application/json");
                JSONObject b = new JSONObject(); b.put("token", fcm);
                Net.call("POST", Net.BASE + "/push/unregister", h, b.toString());
            } catch (Exception e) { }
        }).start();
    }
}
