#include <CoreFoundation/CoreFoundation.h>
#include <CoreGraphics/CoreGraphics.h>
#include <ImageIO/ImageIO.h>

static void stroke_brand_mark(CGContextRef context) {
  CGContextSetLineCap(context, kCGLineCapRound);
  CGContextSetLineJoin(context, kCGLineJoinRound);

  CGContextSetLineWidth(context, 26);
  CGContextSetRGBStrokeColor(context, 246.0 / 255.0, 247.0 / 255.0, 244.0 / 255.0, 1);
  CGContextStrokeEllipseInRect(context, CGRectMake(124, 124, 264, 264));

  CGContextSetLineWidth(context, 42);
  CGContextSetRGBStrokeColor(context, 5.0 / 255.0, 6.0 / 255.0, 7.0 / 255.0, 1);
  CGContextBeginPath(context);
  CGContextMoveToPoint(context, 76, 256);
  CGContextAddCurveToPoint(context, 126, 256, 128, 206, 166, 206);
  CGContextAddCurveToPoint(context, 204, 206, 204, 306, 240, 306);
  CGContextAddCurveToPoint(context, 276, 306, 276, 172, 308, 172);
  CGContextAddCurveToPoint(context, 344, 172, 344, 276, 374, 276);
  CGContextAddCurveToPoint(context, 404, 276, 410, 256, 436, 256);
  CGContextStrokePath(context);

  CGContextSetLineWidth(context, 18);
  CGContextSetRGBStrokeColor(context, 200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, 1);
  CGContextBeginPath(context);
  CGContextMoveToPoint(context, 76, 256);
  CGContextAddCurveToPoint(context, 126, 256, 128, 206, 166, 206);
  CGContextAddCurveToPoint(context, 204, 206, 204, 306, 240, 306);
  CGContextAddCurveToPoint(context, 276, 306, 276, 172, 308, 172);
  CGContextAddCurveToPoint(context, 344, 172, 344, 276, 374, 276);
  CGContextAddCurveToPoint(context, 404, 276, 410, 256, 436, 256);
  CGContextStrokePath(context);
}

static void write_icon(const char *path, size_t size) {
  CGColorSpaceRef colour_space = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(NULL, size, size, 8, size * 4, colour_space,
                                               kCGImageAlphaPremultipliedLast);
  CGContextSetShouldAntialias(context, true);
  CGContextTranslateCTM(context, 0, size);
  CGContextScaleCTM(context, (CGFloat)size / 512.0, -(CGFloat)size / 512.0);

  CGContextSetRGBFillColor(context, 5.0 / 255.0, 6.0 / 255.0, 7.0 / 255.0, 1);
  CGContextFillRect(context, CGRectMake(0, 0, 512, 512));

  CGFloat locations[] = {0, 1};
  CGFloat components[] = {
      200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, .18,
      200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, 0,
  };
  CGGradientRef glow = CGGradientCreateWithColorComponents(colour_space, components, locations, 2);
  CGContextDrawRadialGradient(context, glow, CGPointMake(422, 62), 0, CGPointMake(422, 62), 310, 0);
  CGGradientRelease(glow);

  CGPathRef border = CGPathCreateWithRoundedRect(CGRectMake(30, 30, 452, 452), 80, 80, NULL);
  CGContextAddPath(context, border);
  CGContextSetRGBStrokeColor(context, 200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, .18);
  CGContextSetLineWidth(context, 4);
  CGContextStrokePath(context);
  CGPathRelease(border);

  stroke_brand_mark(context);

  CGImageRef image = CGBitmapContextCreateImage(context);
  CFURLRef url = CFURLCreateFromFileSystemRepresentation(NULL, (const UInt8 *)path, (CFIndex)strlen(path), false);
  CGImageDestinationRef destination = CGImageDestinationCreateWithURL(url, CFSTR("public.png"), 1, NULL);
  CGImageDestinationAddImage(destination, image, NULL);
  CGImageDestinationFinalize(destination);

  CFRelease(destination);
  CFRelease(url);
  CGImageRelease(image);
  CGContextRelease(context);
  CGColorSpaceRelease(colour_space);
}

int main(void) {
  write_icon("public/icons/backthevibes-icon-512.png", 512);
  write_icon("public/icons/backthevibes-icon-512-maskable.png", 512);
  write_icon("public/icons/backthevibes-icon-192.png", 192);
  write_icon("public/icons/backthevibes-apple-touch-icon.png", 180);
  return 0;
}
