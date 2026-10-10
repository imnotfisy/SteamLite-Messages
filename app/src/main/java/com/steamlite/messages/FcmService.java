package com.steamlite.messages;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/** Receives push messages from SteamLite Online (through Firebase) and turns them into notifications. */
public class FcmService extends FirebaseMessagingService {
    @Override
    public void onNewToken(String token) { Push.register(getApplicationContext(), token); }

    @Override
    public void onMessageReceived(RemoteMessage m) {
        android.content.SharedPreferences sp = getApplicationContext().getSharedPreferences("sl", MODE_PRIVATE);
        sp.edit().putLong("lastPushAt", System.currentTimeMillis()).putString("lastPushT", String.valueOf(m.getData().get("t"))).remove("lastPushErr").apply();   // proof the phone received it
        try { Notify.show(getApplicationContext(), m.getData()); } catch (Throwable e) { sp.edit().putString("lastPushErr", e.getClass().getSimpleName() + ": " + e.getMessage()).apply(); }
    }
}
