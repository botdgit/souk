#pragma once
#import <Foundation/Foundation.h>
#import "EXBarCodeScannerInterface.h"

// Stub protocol — see EXBarCodeScannerInterface.h for rationale.
@protocol EXBarCodeScannerProviderInterface <NSObject>
- (id<EXBarCodeScannerInterface>)createBarCodeScanner;
@end
