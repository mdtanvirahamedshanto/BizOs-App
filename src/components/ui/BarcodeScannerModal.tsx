import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useLanguageStore } from '@/utils/translation';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called for every accepted (debounced) scan. Keep modal open for continuous scanning. */
  onScanned: (code: string) => void;
  /** Optional transient feedback line shown under the frame (e.g. "Added: Rice"). */
  feedback?: string | null;
}

const BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'codabar',
  'itf14',
  'qr',
] as const;

export function BarcodeScannerModal({ visible, onClose, onScanned, feedback }: BarcodeScannerModalProps) {
  const isBn = useLanguageStore((s) => s.language) === 'bn';
  const [permission, requestPermission] = useCameraPermissions();
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  // Reset debounce each time the scanner opens.
  useEffect(() => {
    if (visible) lastScanRef.current = { code: '', at: 0 };
  }, [visible]);

  const handleScan = (result: BarcodeScanningResult) => {
    const code = result.data?.trim();
    if (!code) return;
    const now = Date.now();
    // Ignore the same code scanned within 1.5s to avoid duplicate adds.
    if (lastScanRef.current.code === code && now - lastScanRef.current.at < 1500) return;
    lastScanRef.current = { code, at: now };
    onScanned(code);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-12 pb-3 bg-black">
          <Text className="text-white text-sm font-black font-sans">
            {isBn ? 'বারকোড স্ক্যান' : 'Scan Barcode'}
          </Text>
          <TouchableOpacity onPress={onClose} className="h-9 w-9 rounded-full bg-white/15 items-center justify-center">
            <Text className="text-white text-base font-black">✕</Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        {!permission ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        ) : !permission.granted ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text style={{ fontSize: 40 }}>📷</Text>
            <Text className="text-white text-sm font-bold font-sans text-center mt-3">
              {isBn ? 'ক্যামেরা অনুমতি প্রয়োজন' : 'Camera permission required'}
            </Text>
            <Text className="text-slate-400 text-xs font-sans text-center mt-1 mb-5">
              {isBn
                ? 'বারকোড স্ক্যান করতে ক্যামেরা ব্যবহারের অনুমতি দিন।'
                : 'Allow camera access to scan product barcodes.'}
            </Text>
            <TouchableOpacity
              onPress={() => void requestPermission()}
              className="bg-primary rounded-xl px-6 py-3"
              activeOpacity={0.85}
            >
              <Text className="text-white text-xs font-extrabold font-sans">
                {isBn ? 'অনুমতি দিন' : 'Grant Permission'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              onBarcodeScanned={visible ? handleScan : undefined}
            />
            {/* Overlay frame + hint */}
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} className="items-center justify-center">
              <View className="w-64 h-40 border-2 border-white/80 rounded-2xl" />
              <Text className="text-white/90 text-xs font-bold font-sans mt-4 px-6 text-center">
                {isBn ? 'পণ্যের বারকোড ফ্রেমের ভেতরে রাখুন' : 'Align the barcode within the frame'}
              </Text>
              {feedback ? (
                <View className="mt-4 bg-emerald-500 px-4 py-2 rounded-full">
                  <Text className="text-white text-xs font-extrabold font-sans">{feedback}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
