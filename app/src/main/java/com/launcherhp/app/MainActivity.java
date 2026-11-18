package com.launcherhp.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends Activity {

    private static final int REQ_WALLPAPER = 7;
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0A0D16);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false); // file:///android_asset tetap bisa dibuka
        s.setAllowContentAccess(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true; // jangan pernah pindah halaman
            }
        });
        web.addJavascriptInterface(new Bridge(), "Native");
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Tombol Home ditekan saat launcher sudah terbuka: kembali ke tampilan awal
        if (Intent.ACTION_MAIN.equals(intent.getAction())) {
            js("window.__home && window.__home()");
        }
    }

    @Override
    public void onBackPressed() {
        // Launcher tidak boleh tertutup oleh tombol Kembali; hanya menutup panel yang terbuka
        js("window.__back && window.__back()");
    }

    private void js(String code) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(code, null);
        });
    }

    private File dataFile() {
        return new File(getFilesDir(), "launcher-data.json");
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toString("UTF-8");
    }

    private static String iconData(Drawable d) {
        try {
            int n = 96;
            Bitmap b = Bitmap.createBitmap(n, n, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(b);
            d.setBounds(0, 0, n, n);
            d.draw(c);
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.PNG, 100, o);
            b.recycle();
            return "data:image/png;base64," + Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP);
        } catch (Throwable t) {
            return "";
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_WALLPAPER) return;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            js("window.__wallDone && window.__wallDone(null)");
            return;
        }
        final Uri uri = data.getData();
        new Thread(() -> {
            String result = null;
            try {
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                try (InputStream in = getContentResolver().openInputStream(uri)) {
                    BitmapFactory.decodeStream(in, null, bounds);
                }
                int max = Math.max(bounds.outWidth, bounds.outHeight);
                int sample = 1;
                while (max / sample > 2000) sample *= 2;
                BitmapFactory.Options opt = new BitmapFactory.Options();
                opt.inSampleSize = sample;
                Bitmap bmp;
                try (InputStream in = getContentResolver().openInputStream(uri)) {
                    bmp = BitmapFactory.decodeStream(in, null, opt);
                }
                if (bmp != null) {
                    int w = bmp.getWidth(), h = bmp.getHeight(), m = Math.max(w, h);
                    if (m > 1400) {
                        float k = 1400f / m;
                        Bitmap sc = Bitmap.createScaledBitmap(bmp, Math.round(w * k), Math.round(h * k), true);
                        bmp.recycle();
                        bmp = sc;
                    }
                    ByteArrayOutputStream o = new ByteArrayOutputStream();
                    bmp.compress(Bitmap.CompressFormat.JPEG, 80, o);
                    bmp.recycle();
                    result = "data:image/jpeg;base64," + Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP);
                }
            } catch (Throwable ignored) {
            }
            js("window.__wallDone && window.__wallDone(" + (result == null ? "null" : "'" + result + "'") + ")");
        }).start();
    }

    /** Jembatan yang dipanggil dari JavaScript lewat objek global "Native". */
    private class Bridge {

        @JavascriptInterface
        public String getData() {
            try {
                File f = dataFile();
                if (!f.exists()) return "";
                return readAll(new FileInputStream(f));
            } catch (Throwable t) {
                return "";
            }
        }

        @JavascriptInterface
        public void saveData(String json) {
            try {
                File f = dataFile();
                File tmp = new File(f.getPath() + ".tmp");
                try (FileOutputStream out = new FileOutputStream(tmp)) {
                    out.write(json.getBytes("UTF-8"));
                }
                if (!tmp.renameTo(f)) {
                    f.delete();
                    tmp.renameTo(f);
                }
            } catch (Throwable ignored) {
            }
        }

        @JavascriptInterface
        public String listApps() {
            JSONArray arr = new JSONArray();
            try {
                PackageManager pm = getPackageManager();
                Intent q = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
                List<ResolveInfo> list = pm.queryIntentActivities(q, 0);
                Set<String> seen = new HashSet<>();
                for (ResolveInfo ri : list) {
                    String pkg = ri.activityInfo.packageName;
                    if (pkg.equals(getPackageName()) || !seen.add(pkg)) continue;
                    JSONObject o = new JSONObject();
                    o.put("name", String.valueOf(ri.loadLabel(pm)));
                    o.put("path", pkg);
                    o.put("icon", iconData(ri.loadIcon(pm)));
                    arr.put(o);
                }
            } catch (Throwable ignored) {
            }
            return arr.toString();
        }

        /** Mengembalikan string kosong kalau berhasil, atau pesan galat. */
        @JavascriptInterface
        public String launch(String pkg) {
            try {
                Intent li = getPackageManager().getLaunchIntentForPackage(pkg);
                if (li == null) return "tidak ditemukan";
                li.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                runOnUiThread(() -> startActivity(li));
                return "";
            } catch (Throwable t) {
                return "gagal";
            }
        }

        @JavascriptInterface
        public void appInfo(String pkg) {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:" + pkg)));
                } catch (Throwable ignored) {
                }
            });
        }

        @JavascriptInterface
        public void uninstall(String pkg) {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + pkg)));
                } catch (Throwable ignored) {
                }
            });
        }

        @JavascriptInterface
        public void pickWallpaper() {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.setType("image/*");
                    startActivityForResult(Intent.createChooser(i, "Pilih gambar"), REQ_WALLPAPER);
                } catch (Throwable t) {
                    js("window.__wallDone && window.__wallDone(null)");
                }
            });
        }

        @JavascriptInterface
        public void openHomeSettings() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_HOME_SETTINGS));
                } catch (Throwable t) {
                    try {
                        startActivity(new Intent(Settings.ACTION_SETTINGS));
                    } catch (Throwable ignored) {
                    }
                }
            });
        }
    }
}
