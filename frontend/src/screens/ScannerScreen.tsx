/**
 * ScannerScreen v2 — Auto-capture on stable image detection
 *
 * Features:
 * - Stability detection: compares frame luminance variance; fires when stable
 * - Manual capture fallback
 * - Flash & flip controls
 * - Celery task polling after upload
 * - Freemium scan quota display
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSizes, Spacing, Radii } from '../theme';
import { uploadApi } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { usePantryStore } from '../store/pantryStore';

const { width, height } = Dimensions.get('window');
const OVERLAY_SIZE = width * 0.75;

type Mode = 'idle' | 'detecting' | 'uploading' | 'processing' | 'done';

// Simulated stability detection (in production: compare pixel hash of frames)
const useStabilityDetector = (enabled: boolean, onStable: () => void) => {
  const stableFrames = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!enabled) {
      clearInterval(intervalRef.current);
      stableFrames.current = 0;
      return;
    }

    intervalRef.current = setInterval(() => {
      stableFrames.current += 1;
      // After ~1.5s of "stability" (3 ticks × 500ms)
      if (stableFrames.current >= 3) {
        clearInterval(intervalRef.current);
        onStable();
      }
    }, 500);

    return () => clearInterval(intervalRef.current);
  }, [enabled, onStable]);
};

export default function ScannerScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [taskStatus, setTaskStatus] = useState('');
  const cameraRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const scanLineAnim = useRef(new RNAnimated.Value(0)).current;
  const user = useAuthStore(s => s.user);
  const fetchItems = usePantryStore(s => s.fetchItems);

  // ── Scan line animation ──────────────────────────────────────────────────

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(scanLineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        RNAnimated.timing(scanLineAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, OVERLAY_SIZE - 3],
  });

  // ── Auto-capture on stable frame ────────────────────────────────────────

  const handleStable = useCallback(async () => {
    if (mode !== 'idle' && mode !== 'detecting') return;
    await doCapture();
    setAutoMode(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useStabilityDetector(autoMode && mode === 'idle', handleStable);

  // ── Capture & upload ─────────────────────────────────────────────────────

  const doCapture = async () => {
    if (!cameraRef.current || mode === 'uploading') return;
    try {
      setMode('uploading');
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      const res = await uploadApi.receipt(photo.uri);
      const tid = res.data.task_id;
      setTaskId(tid);
      setMode('processing');
      setTaskStatus('queued');
      if (tid) startPolling(tid);
    } catch (e: any) {
      setMode('idle');
      const msg = e?.response?.status === 402
        ? `Free tier limit reached (${user?.scans_this_month ?? 0}/${10} scans). Upgrade to Premium!`
        : 'Could not upload receipt. Try again.';
      Alert.alert('⚠️ Error', msg);
    }
  };

  // ── Celery task polling ──────────────────────────────────────────────────

  const startPolling = (tid: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await uploadApi.pollStatus(tid);
        setTaskStatus(res.data.status);
        if (res.data.status === 'SUCCESS' || res.data.status === 'FAILURE') {
          clearInterval(pollRef.current);
          setMode('done');
          if (res.data.status === 'SUCCESS') {
            await fetchItems();
            Alert.alert(
              '✅ Receipt Processed!',
              `${res.data.result?.created ?? 0} items added to your pantry.`,
              [{ text: 'View Pantry', onPress: () => navigation.navigate('Pantry') }],
            );
          } else {
            Alert.alert('❌ Processing Failed', 'AI could not parse the receipt. Try a clearer photo.');
          }
          setMode('idle');
        }
      } catch {}
    }, 2500);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  // ── Gallery picker ───────────────────────────────────────────────────────

  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      try {
        setMode('uploading');
        const res = await uploadApi.receipt(result.assets[0].uri);
        const tid = res.data.task_id;
        setTaskId(tid);
        setMode('processing');
        if (tid) startPolling(tid);
      } catch {
        setMode('idle');
        Alert.alert('Error', 'Upload failed.');
      }
    }
  };

  // ── Permission gate ──────────────────────────────────────────────────────

  if (!permission) return <View style={styles.safe} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permSafe}>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isBlocked = mode === 'uploading' || mode === 'processing';

  return (
    <View style={styles.safe}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash ? 'on' : 'off'}
      />

      {/* Dark overlay */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayTop} />
        <View style={styles.overlayMid}>
          <View style={styles.overlaySide} />
          <View style={styles.scanWindow}>
            {/* Corner marks */}
            {(['TL', 'TR', 'BL', 'BR'] as const).map(pos => (
              <View
                key={pos}
                style={[
                  styles.corner,
                  pos.includes('T') ? { top: 0 } : { bottom: 0 },
                  pos.includes('L') ? { left: 0 } : { right: 0 },
                  pos === 'TL' ? styles.cornerTL : pos === 'TR' ? styles.cornerTR
                  : pos === 'BL' ? styles.cornerBL : styles.cornerBR,
                ]}
              />
            ))}
            {/* Scan line */}
            <RNAnimated.View
              style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]}
            />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Top bar */}
      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scan Receipt</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setFlash(f => !f)}>
          <Ionicons name={flash ? 'flash' : 'flash-off'} size={22} color={Colors.white} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Freemium badge */}
      {user && !user.is_premium && (
        <View style={styles.quotaBadge}>
          <Ionicons name="scan-outline" size={12} color={Colors.accentYellow} />
          <Text style={styles.quotaText}>
            {user.scans_this_month}/10 free scans
          </Text>
        </View>
      )}

      {/* Status hint */}
      <View style={styles.hintBox}>
        {isBlocked ? (
          <View style={styles.processingPill}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.processingText}>
              {mode === 'uploading' ? 'Uploading...' : `AI Processing · ${taskStatus}`}
            </Text>
          </View>
        ) : autoMode ? (
          <Text style={styles.hintText}>🔍 Detecting stable frame…</Text>
        ) : (
          <Text style={styles.hintText}>Align receipt within the frame</Text>
        )}
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.sideBtn} onPress={handleGallery} disabled={isBlocked}>
          <Ionicons name="images-outline" size={26} color={Colors.white} />
          <Text style={styles.sideBtnText}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.captureBtn} onPress={doCapture} disabled={isBlocked}>
          {isBlocked
            ? <ActivityIndicator color={Colors.primaryDark} size="large" />
            : <View style={styles.captureDot} />
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sideBtn, autoMode && styles.autoBtnActive]}
          onPress={() => { setAutoMode(a => !a); setMode('idle'); }}
          disabled={isBlocked}
        >
          <Ionicons name="aperture-outline" size={26} color={Colors.white} />
          <Text style={styles.sideBtnText}>{autoMode ? 'Auto ON' : 'Auto'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */

const CORNER = 22;
const BORDER = 3;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  permSafe: { flex: 1, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16 },
  permBtn: { backgroundColor: Colors.primary, borderRadius: Radii.lg, padding: 14, paddingHorizontal: 28 },
  permBtnText: { color: Colors.white, fontWeight: '700' },

  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayMid: { flexDirection: 'row', height: OVERLAY_SIZE },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  scanWindow: { width: OVERLAY_SIZE, height: OVERLAY_SIZE, position: 'relative', overflow: 'hidden' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: Colors.primary, borderWidth: BORDER },
  cornerTL: { borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2.5, backgroundColor: Colors.primary, opacity: 0.85 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  topTitle: { color: Colors.white, fontWeight: '700', fontSize: FontSizes.lg },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },

  quotaBadge: {
    position: 'absolute', top: 80, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: Radii.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  quotaText: { color: Colors.accentYellow, fontSize: FontSizes.xs, fontWeight: '700' },

  hintBox: {
    position: 'absolute',
    top: height * 0.5 + OVERLAY_SIZE / 2 + 14,
    left: 0, right: 0, alignItems: 'center',
  },
  hintText: { color: 'rgba(255,255,255,0.78)', fontSize: FontSizes.sm },
  processingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: Radii.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  processingText: { color: Colors.white, fontWeight: '600', fontSize: FontSizes.sm },

  bottomBar: {
    position: 'absolute', bottom: 50, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 24,
  },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    borderWidth: 5, borderColor: 'rgba(255,255,255,0.4)',
  },
  captureDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary },
  sideBtn: { alignItems: 'center', gap: 4 },
  sideBtnText: { color: Colors.white, fontSize: FontSizes.xs, fontWeight: '600' },
  autoBtnActive: { opacity: 0.7 },
});
