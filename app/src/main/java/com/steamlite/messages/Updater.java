package com.steamlite.messages;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Updates the app from inside the app: downloads the new APK from GitHub (with progress), checks it,
 * and hands it to Android's installer. Android always asks the person to confirm, and the new file must be
 * signed with the same key as the installed app or Android refuses it.
 */
final class Updater {
    /** idle, downloading, installing, needperm (Android must be told this app may install), done, error */
    static volatile String state = "idle", error = "";
    static volatile int pct = 0;
    private static File file;

    static boolean hostOk(String h) { return h.equals("github.com") || h.endsWith(".github.com") || h.endsWith(".githubusercontent.com"); }

    static synchronized void start(final Context c, final String url, final String sha, final long size) {
        if ("downloading".equals(state) || "installing".equals(state)) return;
        state = "downloading"; pct = 0; error = "";
        new Thread(() -> {
            try { download(c, url, sha, size); install(c); }
            catch (Throwable e) { fail(e.getMessage() == null ? e.toString() : e.getMessage()); }
        }).start();
    }

    private static void fail(String m) { error = m; state = "error"; }

    private static void download(Context c, String url, String sha, long size) throws Exception {
        URL u = new URL(url);
        if (!"https".equals(u.getProtocol()) || !hostOk(u.getHost())) throw new Exception("That download address is not allowed.");
        HttpURLConnection cn; int hops = 0;
        while (true) {
            cn = (HttpURLConnection) u.openConnection(); cn.setInstanceFollowRedirects(false); cn.setConnectTimeout(15000); cn.setReadTimeout(30000);
            int code = cn.getResponseCode();
            if (code >= 300 && code < 400 && hops++ < 5) {
                String loc = cn.getHeaderField("Location"); cn.disconnect(); u = new URL(u, loc);
                if (!"https".equals(u.getProtocol()) || !hostOk(u.getHost())) throw new Exception("The download moved somewhere that is not allowed.");
                continue;
            }
            if (code != 200) throw new Exception("The download failed (error " + code + "). Try again in a moment.");
            break;
        }
        long len = cn.getContentLengthLong();
        if (size > 0 && len > 0 && len != size) throw new Exception("The download is the wrong size. Try again.");
        file = new File(c.getCacheDir(), "update.apk");
        MessageDigest md = MessageDigest.getInstance("SHA-256"); long got = 0, tot = len > 0 ? len : size;
        try (InputStream in = cn.getInputStream(); OutputStream out = new FileOutputStream(file)) {
            byte[] b = new byte[32768]; int n;
            while ((n = in.read(b)) > 0) {
                out.write(b, 0, n); md.update(b, 0, n); got += n;
                if (tot > 0) pct = (int) Math.min(99, got * 100 / tot);
                if (got > 150L * 1024 * 1024) throw new Exception("The download is far too big.");
            }
        }
        if (size > 0 && file.length() != size) throw new Exception("The download is incomplete. Try again.");
        if (sha != null && !sha.isEmpty()) {
            StringBuilder sb = new StringBuilder(); for (byte x : md.digest()) sb.append(String.format("%02x", x));
            if (!sb.toString().equalsIgnoreCase(sha)) throw new Exception("The download is damaged. Try again.");
        }
        pct = 100;
    }

    /** Gives the downloaded file to Android's installer. */
    static void install(Context c) throws Exception {
        state = "installing";
        if (!c.getPackageManager().canRequestPackageInstalls()) { state = "needperm"; return; }
        PackageInstaller pi = c.getPackageManager().getPackageInstaller();
        int id = pi.createSession(new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL));
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (OutputStream os = s.openWrite("steamlite.apk", 0, file.length()); InputStream in = new FileInputStream(file)) {
                byte[] b = new byte[65536]; int n; while ((n = in.read(b)) > 0) os.write(b, 0, n); s.fsync(os);
            }
            Intent it = new Intent(c, InstallReceiver.class).setAction(InstallReceiver.ACTION);
            PendingIntent pe = PendingIntent.getBroadcast(c, id, it, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
            s.commit(pe.getIntentSender());
        }
    }

    /** The person came back from Android's "allow installs" page: carry on. */
    static void resume(final Context c) {
        if ("needperm".equals(state) && file != null && file.exists() && c.getPackageManager().canRequestPackageInstalls()) {
            new Thread(() -> { try { install(c); } catch (Throwable e) { fail(e.getMessage() == null ? e.toString() : e.getMessage()); } }).start();
        }
    }
}
