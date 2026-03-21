#pragma once
#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>

// Stub protocol — provides the type declarations that ExpoCamera legacy API
// needs at compile time. No barcode scanning is implemented; the runtime
// legacyModule lookup in CameraViewLegacy.swift returns nil when
// expo-barcode-scanner is not installed.
@protocol EXBarCodeScannerInterface <NSObject>
- (void)setSession:(AVCaptureSession *)session;
- (void)setSessionQueue:(dispatch_queue_t)sessionQueue;
- (void)setOnBarCodeScanned:(void (^)(NSDictionary *body))block;
- (void)setIsEnabled:(BOOL)isEnabled;
- (void)setPreviewLayer:(AVCaptureVideoPreviewLayer *)previewLayer;
- (void)setSettings:(NSDictionary *)settings;
- (void)maybeStartBarCodeScanning;
- (void)stopBarCodeScanning;
@end
