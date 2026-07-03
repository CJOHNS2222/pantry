# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Preserve runtime-visible annotations so Capacitor Bridge can read
# @CapacitorPlugin / @Permission via reflection at runtime.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault

# Keep Capacitor annotation classes themselves
-keep class com.getcapacitor.annotation.** { *; }

# Add rules to suppress R8 warnings
-dontwarn kotlin.coroutines.jvm.internal.SpillingKt
-dontwarn kotlin.uuid.ExperimentalUuidApi
-dontwarn kotlin.uuid.Uuid$Companion
-dontwarn kotlin.uuid.Uuid

# Keep WorkManager & Startup
-keep class androidx.work.** { *; }
-dontwarn androidx.work.**
-keep class androidx.startup.** { *; }
-dontwarn androidx.startup.**
-keep class * extends androidx.work.ListenableWorker { *; }

# Keep Room (used by WorkManager internally)
-keep class androidx.room.** { *; }
-dontwarn androidx.room.**
-keep class * extends androidx.room.RoomDatabase { *; }
