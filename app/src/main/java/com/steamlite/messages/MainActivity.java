package com.steamlite.messages;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    static volatile boolean foreground = false;
    private static final int REQ_PICK = 11, REQ_LOCK = 12, REQ_CHAT = 13, PERM_NOTIF = 21, PERM_MIC = 22, PERM_CALL = 23;
    private static MainActivity inst;
    private boolean inCall = false;

    /** Runs a bit of script in the page from anywhere (the push service uses it to ring the call screen). */
    static void jsGlobal(String code) { MainActivity a = inst; if (a != null) a.js(code); }

    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private SharedPreferences sp;
    private String pickId = "";
    private MediaRecorder rec;
    private File recFile;
    private long recStart;
    private long leftAt = 0;
    private boolean locking = false, pageReady = false;
    private String pendingOpen = "", pendingShare = "";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        sp = getSharedPreferences("sl", MODE_PRIVATE);
        inst = this;
        if (Build.VERSION.SDK_INT >= 33) { // Android 13+ gesture back no longer calls onBackPressed: register for it
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, () -> handleBack());
        }
        final Thread.UncaughtExceptionHandler old = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            try { sp.edit().putString("crash", String.valueOf(e) + " @ " + (e.getStackTrace().length > 0 ? e.getStackTrace()[0] : "")).commit(); } catch (Exception x) { }
            if (old != null) old.uncaughtException(t, e);
        });
        Notify.channels(this);
        web = new WebView(this);
        web.setBackgroundColor(0xff0b0f17);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);   // the remote voice of a call and the ring must play without a tap
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        web.addJavascriptInterface(new Bridge(), "SLNative");
        // only our own bundled page may run here; any other link opens in the browser
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("file".equals(u.getScheme()) && u.getPath() != null && u.getPath().startsWith("/android_asset/www/")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
                return true;
            }

            @Override
            public void onPageFinished(WebView v, String url) { pageReady = true; deliverOpen(); deliverShare(); }
        });
        // confirm() / prompt() / alert() in the page need this, or they do nothing
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final android.webkit.PermissionRequest r) {
                ui.post(() -> {
                    if (r.getOrigin() == null || !"file".equals(r.getOrigin().getScheme())) { r.deny(); return; }
                    java.util.ArrayList<String> ok = new java.util.ArrayList<>();
                    for (String res : r.getResources()) {
                        if (android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) ok.add(res);
                        else if (android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res) && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) ok.add(res);
                    }
                    if (ok.isEmpty()) r.deny(); else r.grant(ok.toArray(new String[0]));
                });
            }

            @Override
            public boolean onJsConfirm(WebView v, String url, String msg, final JsResult r) {
                new AlertDialog.Builder(MainActivity.this, android.R.style.Theme_Material_Dialog_Alert).setMessage(msg)
                        .setPositiveButton("OK", (d, w) -> r.confirm()).setNegativeButton("Cancel", (d, w) -> r.cancel()).setOnCancelListener(d -> r.cancel()).show();
                return true;
            }

            @Override
            public boolean onJsAlert(WebView v, String url, String msg, final JsResult r) {
                new AlertDialog.Builder(MainActivity.this, android.R.style.Theme_Material_Dialog_Alert).setMessage(msg)
                        .setPositiveButton("OK", (d, w) -> r.confirm()).setOnCancelListener(d -> r.cancel()).show();
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView v, String url, String msg, String def, final JsPromptResult r) {
                final EditText et = new EditText(MainActivity.this); et.setText(def); et.setSelectAllOnFocus(true);
                new AlertDialog.Builder(MainActivity.this, android.R.style.Theme_Material_Dialog_Alert).setMessage(msg).setView(et)
                        .setPositiveButton("OK", (d, w) -> r.confirm(et.getText().toString())).setNegativeButton("Cancel", (d, w) -> r.cancel()).setOnCancelListener(d -> r.cancel()).show();
                return true;
            }
        });
        pendingOpen = b == null ? getIntent().getStringExtra("open") : null;
        lockscreenFor(pendingOpen);
        if (pendingOpen == null) pendingOpen = "";
        handleSend(getIntent());
        web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        String o = i.getStringExtra("open"); if (o != null) { pendingOpen = o; lockscreenFor(o); deliverOpen(); }
        handleSend(i);
    }

    /** An incoming call opens over the lock screen and wakes the screen. */
    private void lockscreenFor(String open) {
        if (open == null || !open.startsWith("call:") || Build.VERSION.SDK_INT < 27) return;
        try { setShowWhenLocked(true); setTurnScreenOn(true); } catch (Exception e) { }
    }

    /** Something was shared to SteamLite from another app (text, a link or a picture). */
    private void handleSend(final Intent i) {
        if (i == null || !Intent.ACTION_SEND.equals(i.getAction())) return;
        final String type = i.getType() == null ? "" : i.getType();
        if (type.startsWith("text/")) {
            String t = i.getStringExtra(Intent.EXTRA_TEXT); if (t == null || t.isEmpty()) return;
            try { JSONObject o = new JSONObject(); o.put("kind", "text"); o.put("text", t.length() > 1000 ? t.substring(0, 1000) : t); pendingShare = o.toString(); } catch (Exception e) { }
            deliverShare();
        } else if (type.startsWith("image/")) {
            final Uri u = i.getParcelableExtra(Intent.EXTRA_STREAM); if (u == null) return;
            pool.execute(() -> { try { JSONObject o = new JSONObject(processImage(u)); o.put("kind", "image"); pendingShare = o.toString(); ui.post(this::deliverShare); } catch (Exception e) { } });
        }
    }

    private void deliverShare() {
        if (!pageReady || pendingShare.isEmpty()) return;
        final String s = pendingShare; pendingShare = "";
        ui.postDelayed(() -> web.evaluateJavascript("window.onShare&&onShare(" + JSONObject.quote(s) + ")", null), 900);
    }

    private void deliverOpen() {
        if (!pageReady || pendingOpen.isEmpty()) return;
        final String o = pendingOpen; pendingOpen = "";
        ui.postDelayed(() -> web.evaluateJavascript("window.openFromNotif&&openFromNotif(" + JSONObject.quote(o) + ")", null), 900);
    }

    @Override
    protected void onResume() {
        super.onResume();
        foreground = true;
        if (web != null) web.evaluateJavascript("window.onResumeApp&&onResumeApp()", null);
        Updater.resume(this);   // back from Android's "allow installs" page: carry on with the update
        if (!sp.getString("token", "").isEmpty()) Push.start(this);   // re-register this phone every time the app opens
        if (sp.getBoolean("lock", false) && leftAt > 0 && System.currentTimeMillis() - leftAt > 20000 && !locking) askLock();
        leftAt = 0;
        android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.cancelAll();
        Notify.clearHistory(this);
    }

    @Override
    protected void onPause() { super.onPause(); foreground = false; leftAt = System.currentTimeMillis(); }

    /** When the app is not on screen, nothing in the page should keep running (timers, animations): that is most of the battery use. */
    @Override
    protected void onStop() { super.onStop(); if (!inCall && Build.VERSION.SDK_INT >= 27) { try { setShowWhenLocked(false); setTurnScreenOn(false); } catch (Exception e) { } } if (web != null && !inCall) { web.onPause(); web.pauseTimers(); } }

    @Override
    protected void onStart() { super.onStart(); if (web != null) { web.resumeTimers(); web.onResume(); } }

    private void askLock() {
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (km == null || !km.isDeviceSecure()) return;
        Intent i = km.createConfirmDeviceCredentialIntent("SteamLite", "Unlock to continue");
        if (i == null) return;
        locking = true;
        web.evaluateJavascript("window.lockUi&&lockUi(true)", null);
        startActivityForResult(i, REQ_LOCK);
    }

    @Override
    public void onBackPressed() { handleBack(); }

    /** Back button or gesture: the page closes whatever is on top (viewer, sheet, page, chat, tab); at the very top the app closes. */
    private void handleBack() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("(window.onBack?onBack():false)", v -> { if (!"true".equals(v)) finish(); });
    }

    private void js(String code) { ui.post(() -> web.evaluateJavascript(code, null)); }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (web != null) { web.resumeTimers(); web.onResume(); }   // the page must be awake to receive the answer
        if (req == REQ_LOCK) {
            locking = false;
            if (res == RESULT_OK) { leftAt = 0; js("window.lockUi&&lockUi(false)"); }   // if cancelled, the lock screen stays and its button asks again
            return;
        }
        if (req == REQ_CHAT) { js("window.chatAuth&&chatAuth(" + (res == RESULT_OK) + ")"); return; }
        if (req == REQ_PICK) {
            final String id = pickId; pickId = "";
            if (res != RESULT_OK || data == null || data.getData() == null) { js("window.__cb(" + JSONObject.quote(id) + ",null)"); return; }
            final Uri u = data.getData();
            pool.execute(() -> { String out = "null"; try { out = processImage(u); } catch (Exception e) { } js("window.__cb(" + JSONObject.quote(id) + "," + JSONObject.quote(out) + ")"); });
        }
    }

    /** Shrinks a photo so it uploads fast (max 1280 px, JPEG). GIFs are kept as they are when small enough. */
    private String processImage(Uri u) throws Exception {
        String type = getContentResolver().getType(u); if (type == null) type = "";
        if (type.equals("image/gif")) {
            InputStream is = getContentResolver().openInputStream(u); ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n;
            while ((n = is.read(buf)) > 0 && bo.size() < 1100000) bo.write(buf, 0, n); is.close();
            if (bo.size() <= 950000) { JSONObject o = new JSONObject(); o.put("mime", "image/gif"); o.put("data", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP)); o.put("w", 0); o.put("h", 0); return o.toString(); }
            throw new Exception("gif too big");
        }
        BitmapFactory.Options bo = new BitmapFactory.Options(); bo.inJustDecodeBounds = true;
        InputStream a = getContentResolver().openInputStream(u); BitmapFactory.decodeStream(a, null, bo); a.close();
        int sample = 1; while (Math.max(bo.outWidth, bo.outHeight) / sample > 2600) sample *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options(); o2.inSampleSize = sample;
        InputStream b2 = getContentResolver().openInputStream(u); Bitmap bm = BitmapFactory.decodeStream(b2, null, o2); b2.close();
        if (bm == null) throw new Exception("decode");
        int rot = 0;
        try { InputStream e = getContentResolver().openInputStream(u); int ori = new ExifInterface(e).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1); e.close(); rot = ori == 6 ? 90 : ori == 3 ? 180 : ori == 8 ? 270 : 0; } catch (Exception x) { }
        float sc = Math.min(1f, 1280f / Math.max(bm.getWidth(), bm.getHeight()));
        Matrix m = new Matrix(); m.postScale(sc, sc); if (rot != 0) m.postRotate(rot);
        Bitmap out = Bitmap.createBitmap(bm, 0, 0, bm.getWidth(), bm.getHeight(), m, true);
        int q = 82; byte[] bytes;
        do { ByteArrayOutputStream bs = new ByteArrayOutputStream(); out.compress(Bitmap.CompressFormat.JPEG, q, bs); bytes = bs.toByteArray(); q -= 12; } while (bytes.length > 900000 && q > 30);
        JSONObject o = new JSONObject(); o.put("mime", "image/jpeg"); o.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP)); o.put("w", out.getWidth()); o.put("h", out.getHeight());
        return o.toString();
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        super.onRequestPermissionsResult(req, perms, res);
        boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
        if (req == PERM_CALL) { boolean all = res.length > 0; for (int r : res) if (r != PackageManager.PERMISSION_GRANTED) all = false; js("window.__cb('callperm'," + JSONObject.quote(all ? "granted" : "denied") + ")"); return; }
        if (req == PERM_MIC) js("window.__cb('mic'," + JSONObject.quote(ok ? "granted" : "denied") + ")");
        if (req == PERM_NOTIF) js("window.__cb('notif'," + JSONObject.quote(ok ? "granted" : "denied") + ")");
    }

    private void openNotifSettingsNow() {
        try { startActivity(new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName())); }
        catch (Exception e) { try { startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); } catch (Exception x) { } }
    }

    /** What the page can ask the phone to do. Network calls go through here, so no browser cross-site rules get in the way. */
    class Bridge {
        @JavascriptInterface
        public void http(final String id, final String method, final String url, final String headers, final String body) {
            pool.execute(() -> {
                Object[] r;
                try { r = Net.call(method, url, new JSONObject(headers == null || headers.isEmpty() ? "{}" : headers), body); } catch (Exception e) { r = new Object[]{0, String.valueOf(e.getMessage())}; }
                js("window.__http(" + JSONObject.quote(id) + "," + r[0] + "," + JSONObject.quote((String) r[1]) + ")");
            });
        }

        @JavascriptInterface
        public void openUrl(String url) {
            try { Uri u = Uri.parse(url); String sc = u.getScheme(); if ("https".equals(sc) || "steam".equals(sc)) startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
        }

        @JavascriptInterface
        public void copy(String text) {
            ui.post(() -> { android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE); cm.setPrimaryClip(android.content.ClipData.newPlainText("SteamLite", text)); });
        }

        @JavascriptInterface
        public String version() { try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "0.0.0"; } }

        /** The page gives us the sign-in token so the background check can look for new messages. Empty = signed out. */
        @JavascriptInterface
        public void setToken(String tok) {
            String old = sp.getString("token", "");
            sp.edit().putString("token", tok == null ? "" : tok).apply();
            if (tok == null || tok.isEmpty()) { Push.unregister(MainActivity.this, old); PollService.cancel(MainActivity.this); sp.edit().remove("n_req").remove("w_unread").apply(); UnreadWidget.refresh(MainActivity.this); }
            else { if (!sp.getBoolean("pushOn", false)) PollService.schedule(MainActivity.this); Push.start(MainActivity.this); }
        }

        /** The page tells the home-screen widget how many unread messages there are. */
        @JavascriptInterface
        public void setWidget(int unread, String title, String text) { UnreadWidget.set(MainActivity.this, unread, title == null ? "" : title, text == null ? "" : text); }

        @JavascriptInterface
        public boolean pushOn() { return sp.getBoolean("pushOn", false); }

        @JavascriptInterface
        public void setMuteAll(boolean on) { sp.edit().putBoolean("muteAll", on).apply(); }

        @JavascriptInterface
public void askNotif() {
            ui.post(() -> {
                boolean granted = Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
                if (!granted) {
                    // after two refusals Android stops showing its question, so send the person to the settings page instead
                    if (sp.getBoolean("permAsked", false) && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) { openNotifSettingsNow(); js("window.__cb('notif','settings')"); }
                    else { sp.edit().putBoolean("permAsked", true).apply(); requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERM_NOTIF); }
                } else if (!((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE)).areNotificationsEnabled()) { openNotifSettingsNow(); js("window.__cb('notif','settings')"); }
                else js("window.__cb('notif','granted')");
            });
        }

        /** What is set up for notifications on this phone, as JSON, so the page can show what is wrong. */
        @JavascriptInterface
        public String notifState() {
            try {
                JSONObject o = new JSONObject();
                boolean perm = Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                o.put("permission", perm); o.put("enabled", nm.areNotificationsEnabled());
                boolean ch = true; if (Build.VERSION.SDK_INT >= 26) { android.app.NotificationChannel c = nm.getNotificationChannel(Notify.MSG); ch = c == null || c.getImportance() != android.app.NotificationManager.IMPORTANCE_NONE; }
                o.put("channel", ch); o.put("push", sp.getBoolean("pushOn", false)); o.put("hasToken", !sp.getString("fcm", "").isEmpty()); o.put("error", sp.getString("pushErr", ""));
                boolean play = false; try { play = getPackageManager().getApplicationInfo("com.google.android.gms", 0).enabled; } catch (Exception e) { } o.put("play", play);
                o.put("muted", sp.getBoolean("muteAll", false)); o.put("sdk", Build.VERSION.SDK_INT);
                o.put("lastPushAt", sp.getLong("lastPushAt", 0)); o.put("lastShownAt", sp.getLong("lastShownAt", 0)); o.put("lastPushErr", sp.getString("lastPushErr", "")); o.put("lastPushT", sp.getString("lastPushT", ""));
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE); o.put("batteryOpt", pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())); o.put("maker", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface
        public void openNotifSettings() { ui.post(() -> openNotifSettingsNow()); }

        /** The phone's page about this app (battery, permissions, data usage). */
        @JavascriptInterface
        public void openAppSettings() { ui.post(() -> { try { startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); } catch (Exception e) { } }); }

        /** In-app update: download the new version and hand it to Android's installer. */
        @JavascriptInterface
        public void updStart(String url, String sha, double size) { Updater.start(MainActivity.this, url, sha, (long) size); }

        @JavascriptInterface
        public String updState() { try { JSONObject o = new JSONObject(); o.put("state", Updater.state); o.put("pct", Updater.pct); o.put("error", Updater.error); return o.toString(); } catch (Exception e) { return "{}"; } }

        @JavascriptInterface
        public void updReset() { Updater.state = "idle"; Updater.error = ""; Updater.pct = 0; }

        /** Android's page where the person lets SteamLite install updates. */
        @JavascriptInterface
        public void openInstallSettings() { ui.post(() -> { try { startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))); } catch (Exception e) { openNotifSettingsNow(); } }); }

        /** Which kinds of notification are wanted (JSON like {"msg":true,"deal":false}). */
        @JavascriptInterface
        public void setNotifTypes(String json) { sp.edit().putString("ntypes", json == null ? "{}" : json).apply(); }

        /** Do Not Disturb: notifications arrive silently between these times (minutes after midnight). */
        @JavascriptInterface
        public void setDnd(boolean on, int fromMin, int toMin) { sp.edit().putBoolean("dndOn", on).putInt("dndFrom", fromMin).putInt("dndTo", toMin).apply(); }

        /** The friends widget: how many are online and a few names (one per line). */
        @JavascriptInterface
        public void setStreakWidget(int days, boolean done) { StreakWidget.set(MainActivity.this, days, done); }

        /** Shares plain text (a chat export) through Android's share sheet: save to Files, send by email... */
        @JavascriptInterface
        public void shareText(String title, String text) {
            final String t = text == null ? "" : (text.length() > 400000 ? text.substring(0, 400000) : text);
            ui.post(() -> { try { Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_SUBJECT, title).putExtra(Intent.EXTRA_TEXT, t); startActivity(Intent.createChooser(i, title)); } catch (Exception e) { } });
        }

        /** A QR picture (as a data: web address) for the given text. */
        @JavascriptInterface
        public String qrPng(String text) {
            try {
                java.util.Map<com.google.zxing.EncodeHintType, Object> hints = new java.util.HashMap<>(); hints.put(com.google.zxing.EncodeHintType.MARGIN, 1);
                com.google.zxing.common.BitMatrix m = new com.google.zxing.qrcode.QRCodeWriter().encode(text, com.google.zxing.BarcodeFormat.QR_CODE, 512, 512, hints);
                int[] px = new int[512 * 512]; for (int y = 0; y < 512; y++) for (int x = 0; x < 512; x++) px[y * 512 + x] = m.get(x, y) ? 0xFF000000 : 0xFFFFFFFF;
                Bitmap bm = Bitmap.createBitmap(px, 512, 512, Bitmap.Config.ARGB_8888); ByteArrayOutputStream bo = new ByteArrayOutputStream(); bm.compress(Bitmap.CompressFormat.PNG, 100, bo);
                return "data:image/png;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
            } catch (Throwable e) { return ""; }
        }

        /** Opens Google's QR scanner; the answer (the text in the code, or null) comes back through window.__cb(id, text). */
        @JavascriptInterface
        public void scanQr(final String id) {
            ui.post(() -> {
                try {
                    com.google.mlkit.vision.codescanner.GmsBarcodeScanning.getClient(MainActivity.this).startScan()
                            .addOnSuccessListener(b -> js("window.__cb(" + JSONObject.quote(id) + "," + JSONObject.quote(b.getRawValue() == null ? "" : b.getRawValue()) + ")"))
                            .addOnFailureListener(e -> js("window.__cb(" + JSONObject.quote(id) + ",null)"))
                            .addOnCanceledListener(() -> js("window.__cb(" + JSONObject.quote(id) + ",null)"));
                } catch (Throwable t) { js("window.__cb(" + JSONObject.quote(id) + ",null)"); }
            });
        }

        /** The main colour of a game cover (for "use this game's colours"). Answer: window.__cb(id, "#rrggbb" or null). */
        @JavascriptInterface
        public void coverColor(final String url, final String id) {
            pool.execute(() -> {
                String out = "null";
                try {
                    Uri u = Uri.parse(url == null ? "" : url); String host = u.getHost() == null ? "" : u.getHost();
                    if ("https".equals(u.getScheme()) && (host.endsWith("steamstatic.com") || host.endsWith("akamaihd.net"))) {
                        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection(); c.setConnectTimeout(8000); c.setReadTimeout(8000);
                        InputStream in = c.getInputStream(); BitmapFactory.Options o = new BitmapFactory.Options(); o.inSampleSize = 4; Bitmap bm = BitmapFactory.decodeStream(in, null, o); in.close();
                        if (bm != null) {
                            double rs = 0, gs = 0, bs = 0, ws = 0;
                            for (int y = 0; y < bm.getHeight(); y += 2) for (int x = 0; x < bm.getWidth(); x += 2) {
                                int p = bm.getPixel(x, y), r = (p >> 16) & 255, g = (p >> 8) & 255, b = p & 255, mx = Math.max(r, Math.max(g, b)), mn = Math.min(r, Math.min(g, b));
                                double sat = mx == 0 ? 0 : (mx - mn) / (double) mx, w = sat * sat * (mx / 255.0) + 0.001;
                                rs += r * w; gs += g * w; bs += b * w; ws += w;
                            }
                            if (ws > 0) out = JSONObject.quote(String.format("#%02x%02x%02x", (int) (rs / ws), (int) (gs / ws), (int) (bs / ws)));
                        }
                    }
                } catch (Exception e) { }
                final String o2 = out; js("window.__cb(" + JSONObject.quote(id) + "," + o2 + ")");
            });
        }

        @JavascriptInterface
        public void setFriendsWidget(int online, String names) { }

        /** Saves a picture (a web address or a data: picture) into the phone's Pictures/SteamLite folder. */
        @JavascriptInterface
        public void saveImage(final String src, final String name) {
            pool.execute(() -> {
                String msg = "Could not save the picture.";
                try {
                    byte[] data; String mime = "image/png";
                    if (src.startsWith("data:")) { int c = src.indexOf(','); String head = src.substring(5, c); mime = head.contains(";") ? head.substring(0, head.indexOf(';')) : head; data = Base64.decode(src.substring(c + 1), Base64.DEFAULT); }
                    else {
                        java.net.URL u = new java.net.URL(src); String h = u.getHost();
                        if (!"https".equals(u.getProtocol()) || !(h.endsWith(".workers.dev") || h.endsWith(".tenor.com") || h.equals("tenor.com") || h.endsWith("steamstatic.com"))) throw new Exception("not allowed");
                        java.net.HttpURLConnection cn = (java.net.HttpURLConnection) u.openConnection(); cn.setConnectTimeout(15000); cn.setReadTimeout(30000);
                        mime = cn.getContentType() == null ? "image/jpeg" : cn.getContentType().split(";")[0]; InputStream in = cn.getInputStream(); ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n; while ((n = in.read(buf)) > 0 && bo.size() < 12 * 1024 * 1024) bo.write(buf, 0, n); in.close(); data = bo.toByteArray();
                    }
                    String ext = mime.contains("png") ? "png" : mime.contains("gif") ? "gif" : mime.contains("webp") ? "webp" : "jpg", fname = (name == null || name.isEmpty() ? "steamlite" : name.replaceAll("[^A-Za-z0-9_-]", "")) + "-" + System.currentTimeMillis() + "." + ext;
                    if (Build.VERSION.SDK_INT >= 29) {
                        android.content.ContentValues cv = new android.content.ContentValues(); cv.put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, fname); cv.put(android.provider.MediaStore.Images.Media.MIME_TYPE, mime); cv.put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, "Pictures/SteamLite");
                        Uri uri = getContentResolver().insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv); java.io.OutputStream os = getContentResolver().openOutputStream(uri); os.write(data); os.close(); msg = "Saved to Pictures/SteamLite";
                    } else {
                        File dir = new File(getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES), "SteamLite"); dir.mkdirs(); FileOutputStream fo = new FileOutputStream(new File(dir, fname)); fo.write(data); fo.close(); msg = "Saved to the app's Pictures folder";
                    }
                } catch (Exception e) { }
                final String m = msg; ui.post(() -> android.widget.Toast.makeText(MainActivity.this, m, android.widget.Toast.LENGTH_SHORT).show());
            });
        }

        @JavascriptInterface
        public void repush() { ui.post(() -> Push.start(MainActivity.this)); }

        @JavascriptInterface
        public void pickImage(final String id) {
            ui.post(() -> {
                pickId = id;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(Intent.createChooser(i, "Choose a photo"), REQ_PICK); } catch (Exception e) { js("window.__cb(" + JSONObject.quote(id) + ",null)"); }
            });
        }

        /** Asks for the microphone (and camera for a video call). The answer comes back as __cb('callperm', 'granted' | 'denied'). */
        @JavascriptInterface
        public void callPerms(final boolean video) {
            ui.post(() -> {
                java.util.ArrayList<String> need = new java.util.ArrayList<>();
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) need.add(Manifest.permission.RECORD_AUDIO);
                if (video && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) need.add(Manifest.permission.CAMERA);
                if (need.isEmpty()) js("window.__cb('callperm','granted')"); else requestPermissions(need.toArray(new String[0]), PERM_CALL);
            });
        }

        /** A call started or ended: keeps the app (and its microphone) running in the background and puts the phone in call-audio mode. */
        @JavascriptInterface
        public void callState(final boolean on, final String name, final boolean video) {
            ui.post(() -> {
                inCall = on;
                android.media.AudioManager am = (android.media.AudioManager) getSystemService(AUDIO_SERVICE);
                try {
                    if (on) {
                        if (am != null) am.setMode(android.media.AudioManager.MODE_IN_COMMUNICATION);
                        setVolumeControlStream(android.media.AudioManager.STREAM_VOICE_CALL);
                        Intent si = new Intent(MainActivity.this, CallService.class).putExtra("name", name == null ? "" : name).putExtra("video", video);
                        if (Build.VERSION.SDK_INT >= 26) startForegroundService(si); else startService(si);
                    } else {
                        if (am != null) { am.setSpeakerphoneOn(false); am.setMode(android.media.AudioManager.MODE_NORMAL); }
                        setVolumeControlStream(android.media.AudioManager.USE_DEFAULT_STREAM_TYPE);
                        stopService(new Intent(MainActivity.this, CallService.class));
                        if (!foreground && web != null) { web.onPause(); web.pauseTimers(); }
                    }
                } catch (Exception e) { }
            });
        }

        @JavascriptInterface
        public void setSpeaker(final boolean on) {
            ui.post(() -> { try { android.media.AudioManager am = (android.media.AudioManager) getSystemService(AUDIO_SERVICE); if (am != null) am.setSpeakerphoneOn(on); } catch (Exception e) { } });
        }

        @JavascriptInterface
        public void recStart() {
            ui.post(() -> {
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, PERM_MIC); return; }
                try {
                    recFile = new File(getCacheDir(), "voice.m4a");
                    rec = new MediaRecorder();
                    rec.setAudioSource(MediaRecorder.AudioSource.MIC);
                    rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
                    rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
                    rec.setAudioEncodingBitRate(40000);
                    rec.setAudioSamplingRate(22050);
                    rec.setMaxDuration(60000);
                    rec.setOutputFile(recFile.getAbsolutePath());
                    rec.setOnInfoListener((mr, what, extra) -> { if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) js("window.onRecLimit&&onRecLimit()"); });
                    rec.prepare(); rec.start(); recStart = System.currentTimeMillis();
                    js("window.__cb('mic','recording')");
                } catch (Exception e) { rec = null; js("window.__cb('mic','error')"); }
            });
        }

        /** Stops recording and hands the audio back through __cb('rec', json). cancel=true throws it away. */
        @JavascriptInterface
        public void recStop(final boolean cancel) {
            ui.post(() -> {
                if (rec == null) { js("window.__cb('rec',null)"); return; }
                final long ms = System.currentTimeMillis() - recStart;
                try { rec.stop(); } catch (Exception e) { cancel0(); js("window.__cb('rec',null)"); return; }
                rec.release(); rec = null;
                if (cancel || ms < 700) { js("window.__cb('rec',null)"); return; }
                pool.execute(() -> {
                    String out = "null";
                    try {
                        FileInputStream is = new FileInputStream(recFile); ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n;
                        while ((n = is.read(buf)) > 0) bo.write(buf, 0, n); is.close();
                        if (bo.size() < 900000) { JSONObject o = new JSONObject(); o.put("mime", "audio/mp4"); o.put("data", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP)); o.put("ms", ms); out = o.toString(); }
                    } catch (Exception e) { }
                    js("window.__cb('rec'," + JSONObject.quote(out) + ")");
                });
            });
        }

        private void cancel0() { try { rec.release(); } catch (Exception e) { } rec = null; }

        @JavascriptInterface
        public void haptic(String kind) {
            ui.post(() -> {
                int c = "heavy".equals(kind) ? HapticFeedbackConstants.LONG_PRESS : (Build.VERSION.SDK_INT >= 30 && "ok".equals(kind)) ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.KEYBOARD_TAP;
                web.performHapticFeedback(c);
            });
        }

        /** Colours the status and navigation bars to match the page's theme. */
        @JavascriptInterface
        public void setBars(final String hex, final boolean lightBackground) {
            ui.post(() -> {
                try {
                    int c = Color.parseColor(hex);
                    getWindow().setStatusBarColor(c); getWindow().setNavigationBarColor(c);
                    View d = getWindow().getDecorView(); int f = d.getSystemUiVisibility();
                    f = lightBackground ? (f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0)) : (f & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR & ~(Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0));
                    d.setSystemUiVisibility(f);
                    web.setBackgroundColor(c);
                } catch (Exception e) { }
            });
        }

        /** Ask for the fingerprint/PIN to open a locked chat. The answer comes back to window.chatAuth(true/false). */
        @JavascriptInterface
        public void authChat() {
            ui.post(() -> {
                KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
                Intent i = km == null || !km.isDeviceSecure() ? null : km.createConfirmDeviceCredentialIntent("SteamLite", "Unlock this chat");
                if (i == null) { js("window.chatAuth&&chatAuth(true)"); return; }
                startActivityForResult(i, REQ_CHAT);
            });
        }

        @JavascriptInterface
        public boolean metered() { try { android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE); return cm != null && cm.isActiveNetworkMetered(); } catch (Exception e) { return false; } }

        @JavascriptInterface
        public boolean batteryFree() { try { android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE); return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName()); } catch (Exception e) { return true; } }

        @JavascriptInterface
        public void openBatterySettings() { try { startActivity(new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception e) { } }

        @JavascriptInterface
        public String dndOn() { return String.valueOf(sp.getBoolean("dndOn", false)); }

        @JavascriptInterface
        public boolean canLock() { KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE); return km != null && km.isDeviceSecure(); }

        @JavascriptInterface
        public void setLock(boolean on) { sp.edit().putBoolean("lock", on).apply(); }

        @JavascriptInterface
        public String takeCrash() { String c = sp.getString("crash", ""); if (!c.isEmpty()) sp.edit().remove("crash").apply(); return c; }

        @JavascriptInterface
        public void unlock() { ui.post(() -> { if (!locking) askLock(); }); }

        @JavascriptInterface
        public void exit() { ui.post(() -> finish()); }
    }
}
