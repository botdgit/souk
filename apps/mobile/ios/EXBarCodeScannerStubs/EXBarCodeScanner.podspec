Pod::Spec.new do |s|
  s.name         = 'EXBarCodeScanner'
  s.version      = '13.0.0'
  s.summary      = 'Stub protocol headers — provides EXBarCodeScannerInterface and ' \
                   'EXBarCodeScannerProviderInterface so ExpoCamera legacy API compiles ' \
                   'without the full expo-barcode-scanner package installed.'
  s.homepage     = 'https://github.com/expo/expo'
  s.license      = { :type => 'MIT' }
  s.author       = { 'Expo' => 'support@expo.io' }
  s.platform     = :ios, '13.4'
  s.source       = { :path => '.' }
  s.source_files = '*.h'
  s.public_header_files = '*.h'
end
