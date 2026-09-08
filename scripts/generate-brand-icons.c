#include <CoreFoundation/CoreFoundation.h>
#include <CoreGraphics/CoreGraphics.h>
#include <ImageIO/ImageIO.h>

static void stroke_brand_mark(CGContextRef context) {
  CGContextSetLineCap(context, kCGLineCapRound);
  CGContextSetLineJoin(context, kCGLineJoinRound);
  CGContextSetLineWidth(context, 32);
  CGContextSetRGBStrokeColor(context, 246.0 / 255.0, 247.0 / 255.0, 244.0 / 255.0, 1);

  CGContextBeginPath(context);
  CGContextMoveToPoint(context, 132, 112);
  CGContextAddLineToPoint(context, 132, 400);
  CGContextMoveToPoint(context, 132, 112);
  CGContextAddLineToPoint(context, 240, 112);
  CGContextAddCurveToPoint(context, 296, 112, 326, 140, 326, 184);
  CGContextAddCurveToPoint(context, 326, 230, 292, 256, 236, 256);
  CGContextAddLineToPoint(context, 132, 256);
  CGContextMoveToPoint(context, 132, 256);
  CGContextAddLineToPoint(context, 246, 256);
  CGContextAddCurveToPoint(context, 308, 256, 340, 284, 340, 330);
  CGContextAddCurveToPoint(context, 340, 376, 308, 400, 246, 400);
  CGContextAddLineToPoint(context, 132, 400);
  CGContextStrokePath(context);

  CGContextSetRGBStrokeColor(context, 200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, 1);
  CGContextBeginPath(context);
  CGContextMoveToPoint(context, 310, 106);
  CGContextAddLineToPoint(context, 374, 208);
  CGContextAddLineToPoint(context, 438, 106);
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
