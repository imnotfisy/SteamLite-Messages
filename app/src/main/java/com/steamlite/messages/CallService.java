package com.steamlite.messages;

import android.app.Notification;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/** Keeps the microphone alive while a call is going on and the app is in the background. */
public class CallService extends Service {
    static final int ID = 4242;

    @Override
    public int onStartCommand(Intent i, int flags, int startId) {
        String name = i == null ? "" : i.getStringExtra("name");
        boolean video = i != null && i.getBooleanExtra("video", false);
        try {
            Notification n = Notify.ongoingCall(this, name == null ? "" : name, video);
            if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            else startForeground(ID, n);
        } catch (Throwable e) { stopSelf(); }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent i) { return null; }
}
