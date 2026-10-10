package com.steamlite.messages;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/** Plays the chosen sound pack inside the app: a preview, the message sound while the app is open, and the looping ringtone of an incoming call. */
final class Ringer {
    private static MediaPlayer mp;
    private static Ringtone rt;

    static synchronized void play(Context c, String pack, String kind, boolean loop) {
        stop();
        try {
            Uri u = "system".equals(pack) ? null : Notify.soundUri(c, pack, kind);
            AudioAttributes aa = new AudioAttributes.Builder().setUsage(loop ? AudioAttributes.USAGE_NOTIFICATION_RINGTONE : AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            if (u == null) {
                rt = RingtoneManager.getRingtone(c, RingtoneManager.getDefaultUri(loop ? RingtoneManager.TYPE_RINGTONE : RingtoneManager.TYPE_NOTIFICATION));
                if (rt != null) { rt.setAudioAttributes(aa); if (Build.VERSION.SDK_INT >= 28) rt.setLooping(loop); rt.play(); }
                return;
            }
            final MediaPlayer m = new MediaPlayer(); mp = m;
            m.setAudioAttributes(aa); m.setDataSource(c, u); m.setLooping(loop);
            m.setOnCompletionListener(x -> { if (!loop) stop(); });
            m.prepare(); m.start();
        } catch (Exception e) { stop(); }
    }

    static synchronized void stop() {
        try { if (mp != null) { mp.stop(); } } catch (Exception e) { }
        try { if (mp != null) { mp.release(); } } catch (Exception e) { }
        mp = null;
        try { if (rt != null) rt.stop(); } catch (Exception e) { }
        rt = null;
    }
}
