#include <CoreFoundation/CoreFoundation.h>
#include <CoreGraphics/CoreGraphics.h>
#include <ImageIO/ImageIO.h>
#include <string.h>

static CGColorRef colour(CGFloat red, CGFloat green, CGFloat blue, CGFloat alpha) {
  CGFloat values[] = {red / 255.0, green / 255.0, blue / 255.0, alpha};
  CGColorSpaceRef space = CGColorSpaceCreateDeviceRGB();
  CGColorRef result = CGColorCreate(space, values);
  CGColorSpaceRelease(space);
  return result;
}

static void draw_disc(CGContextRef context, CGFloat x, CGFloat y, CGFloat radius,
                      CGFloat red, CGFloat green, CGFloat blue) {
  CGContextSaveGState(context);
  CGContextAddEllipseInRect(context, CGRectMake(x - radius, y - radius, radius * 2, radius * 2));
  CGContextClip(context);
  CGColorSpaceRef space = CGColorSpaceCreateDeviceRGB();
  CGFloat locations[] = {0, .48, 1};
  CGFloat components[] = {
      1, 1, 1, .92,
      red / 255.0, green / 255.0, blue / 255.0, 1,
      red / 1020.0, green / 1020.0, blue / 1020.0, 1,
  };
  CGGradientRef gradient = CGGradientCreateWithColorComponents(space, components, locations, 3);
  CGContextDrawRadialGradient(context, gradient, CGPointMake(x - radius * .28, y - radius * .34), 0,
                              CGPointMake(x, y), radius * 1.18, 0);
  CGGradientRelease(gradient);
  CGColorSpaceRelease(space);
  CGContextRestoreGState(context);

  CGContextSetRGBStrokeColor(context, 246.0 / 255.0, 247.0 / 255.0, 244.0 / 255.0, .13);
  CGContextSetLineWidth(context, 2);
  CGContextStrokeEllipseInRect(context, CGRectMake(x - radius * .78, y - radius * .78, radius * 1.56, radius * 1.56));
  CGContextStrokeEllipseInRect(context, CGRectMake(x - radius * .58, y - radius * .58, radius * 1.16, radius * 1.16));
  CGContextSetRGBFillColor(context, 5.0 / 255.0, 6.0 / 255.0, 7.0 / 255.0, 1);
  CGContextFillEllipseInRect(context, CGRectMake(x - radius * .15, y - radius * .15, radius * .3, radius * .3));
}

static void draw_sleeve(CGContextRef context, CGRect rect, CGFloat radius,
                        CGFloat red, CGFloat green, CGFloat blue,
                        CGFloat border_red, CGFloat border_green, CGFloat border_blue) {
  CGPathRef path = CGPathCreateWithRoundedRect(rect, radius, radius, NULL);
  CGColorSpaceRef space = CGColorSpaceCreateDeviceRGB();
  CGColorRef top = colour(red, green, blue, 1);
  CGColorRef bottom = colour(red * .34, green * .34, blue * .34, 1);
  const void *values[] = {top, bottom};
  CFArrayRef colours = CFArrayCreate(NULL, values, 2, &kCFTypeArrayCallBacks);
  CGFloat locations[] = {0, 1};
  CGGradientRef gradient = CGGradientCreateWithColors(space, colours, locations);

  CGContextSaveGState(context);
  CGContextAddPath(context, path);
  CGContextClip(context);
  CGContextDrawLinearGradient(context, gradient, CGPointMake(rect.origin.x, rect.origin.y),
                              CGPointMake(CGRectGetMaxX(rect), CGRectGetMaxY(rect)), 0);
  CGContextRestoreGState(context);

  CGContextAddPath(context, path);
  CGContextSetRGBStrokeColor(context, border_red / 255.0, border_green / 255.0, border_blue / 255.0, .48);
  CGContextSetLineWidth(context, 3);
  CGContextStrokePath(context);

  CGGradientRelease(gradient);
  CFRelease(colours);
  CGColorRelease(top);
  CGColorRelease(bottom);
  CGColorSpaceRelease(space);
  CGPathRelease(path);
}

static void draw_brand_mark(CGContextRef context) {
  draw_disc(context, 154, 214, 86, 36, 75, 255);
  draw_disc(context, 358, 214, 86, 168, 205, 36);
  draw_disc(context, 256, 196, 98, 174, 179, 175);

  draw_sleeve(context, CGRectMake(76, 226, 150, 190), 20, 16, 27, 57, 36, 75, 255);
  draw_sleeve(context, CGRectMake(286, 226, 150, 190), 20, 29, 38, 11, 200, 243, 63);
  draw_sleeve(context, CGRectMake(181, 216, 150, 208), 20, 26, 28, 28, 246, 247, 244);

  CGContextSetRGBStrokeColor(context, 246.0 / 255.0, 247.0 / 255.0, 244.0 / 255.0, .2);
  CGContextSetLineWidth(context, 3);
  CGContextStrokeEllipseInRect(context, CGRectMake(210, 274, 92, 92));
  CGContextSetRGBFillColor(context, 200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, 1);
  CGContextFillEllipseInRect(context, CGRectMake(249, 313, 14, 14));
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

  CGColorSpaceRef space = CGColorSpaceCreateDeviceRGB();
  CGFloat locations[] = {0, 1};
  CGFloat components[] = {
      200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, .16,
      200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, 0,
  };
  CGGradientRef glow = CGGradientCreateWithColorComponents(space, components, locations, 2);
  CGContextDrawRadialGradient(context, glow, CGPointMake(420, 62), 0, CGPointMake(420, 62), 310, 0);
  CGGradientRelease(glow);
  CGColorSpaceRelease(space);

  CGPathRef border = CGPathCreateWithRoundedRect(CGRectMake(30, 30, 452, 452), 80, 80, NULL);
  CGContextAddPath(context, border);
  CGContextSetRGBStrokeColor(context, 200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, .16);
  CGContextSetLineWidth(context, 4);
  CGContextStrokePath(context);
  CGPathRelease(border);

  draw_brand_mark(context);

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
