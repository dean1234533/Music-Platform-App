#include <CoreFoundation/CoreFoundation.h>
#include <CoreGraphics/CoreGraphics.h>
#include <ImageIO/ImageIO.h>
#include <math.h>
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
  CGFloat locations[] = {0, .46, 1};
  CGFloat components[] = {
      fmin(1, red / 170.0), fmin(1, green / 170.0), fmin(1, blue / 170.0), 1,
      red / 255.0, green / 255.0, blue / 255.0, 1,
      red / 1275.0, green / 1275.0, blue / 1275.0, 1,
  };
  CGGradientRef gradient = CGGradientCreateWithColorComponents(space, components, locations, 3);
  CGContextDrawRadialGradient(context, gradient, CGPointMake(x - radius * .28, y - radius * .34), 0,
                              CGPointMake(x, y), radius * 1.18, 0);
  CGGradientRelease(gradient);
  CGColorSpaceRelease(space);
  CGContextRestoreGState(context);

  CGContextSetRGBStrokeColor(context, 246.0 / 255.0, 247.0 / 255.0, 244.0 / 255.0, .13);
  CGContextSetLineWidth(context, 1.5);
  const CGFloat groove_scales[] = {.88, .74, .58, .4};
  for (int i = 0; i < 4; i++) {
    CGFloat groove = radius * groove_scales[i];
    CGContextStrokeEllipseInRect(context, CGRectMake(x - groove, y - groove, groove * 2, groove * 2));
  }
  CGContextSetLineWidth(context, 3);
  CGContextSetLineCap(context, kCGLineCapRound);
  CGContextBeginPath(context);
  CGContextAddArc(context, x, y, radius * .88, 3.8, 4.45, 0);
  CGContextStrokePath(context);
  CGContextSetRGBFillColor(context, 5.0 / 255.0, 6.0 / 255.0, 7.0 / 255.0, 1);
  CGContextFillEllipseInRect(context, CGRectMake(x - radius * .16, y - radius * .16, radius * .32, radius * .32));
  CGContextSetRGBFillColor(context, fmin(1, red / 160.0), fmin(1, green / 160.0), fmin(1, blue / 160.0), 1);
  CGContextFillEllipseInRect(context, CGRectMake(x - 3, y - 3, 6, 6));
}

static void draw_sleeve(CGContextRef context, CGRect rect, CGFloat radius, CGFloat angle, int artwork,
                        CGFloat red, CGFloat green, CGFloat blue,
                        CGFloat border_red, CGFloat border_green, CGFloat border_blue) {
  CGFloat centre_x = CGRectGetMidX(rect);
  CGFloat centre_y = CGRectGetMidY(rect);
  CGContextSaveGState(context);
  CGContextTranslateCTM(context, centre_x, centre_y);
  CGContextRotateCTM(context, angle);
  CGContextTranslateCTM(context, -centre_x, -centre_y);

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

  CGContextSetRGBStrokeColor(context, border_red / 255.0, border_green / 255.0, border_blue / 255.0, .3);
  CGContextSetLineWidth(context, 2);
  CGContextSetLineCap(context, kCGLineCapRound);
  CGContextBeginPath(context);
  CGContextMoveToPoint(context, rect.origin.x + 18, rect.origin.y + 23);
  CGContextAddLineToPoint(context, rect.origin.x + 55, rect.origin.y + 23);
  CGContextMoveToPoint(context, rect.origin.x + 18, rect.origin.y + 31);
  CGContextAddLineToPoint(context, rect.origin.x + 42, rect.origin.y + 31);
  CGContextStrokePath(context);

  if (artwork == 0) {
    CGContextSetRGBFillColor(context, 36.0 / 255.0, 75.0 / 255.0, 1, .7);
    CGContextFillEllipseInRect(context, CGRectMake(centre_x - 23, rect.origin.y + 72, 46, 46));
    CGContextSetRGBFillColor(context, 149.0 / 255.0, 165.0 / 255.0, 1, .25);
    CGContextFillEllipseInRect(context, CGRectMake(centre_x - 8, rect.origin.y + 80, 16, 16));
    CGContextSetRGBFillColor(context, 141.0 / 255.0, 160.0 / 255.0, 1, .45);
    CGContextFillEllipseInRect(context, CGRectMake(rect.origin.x + 27, rect.origin.y + 62, 4, 4));
    CGContextFillEllipseInRect(context, CGRectMake(rect.origin.x + 113, rect.origin.y + 48, 3, 3));
    CGContextFillEllipseInRect(context, CGRectMake(rect.origin.x + 98, rect.origin.y + 116, 3, 3));
    CGContextSetRGBFillColor(context, 36.0 / 255.0, 75.0 / 255.0, 1, .22);
    CGContextBeginPath(context);
    CGContextMoveToPoint(context, rect.origin.x + 16, rect.origin.y + 160);
    CGContextAddCurveToPoint(context, rect.origin.x + 45, rect.origin.y + 132,
                             rect.origin.x + 82, rect.origin.y + 170,
                             CGRectGetMaxX(rect) - 16, rect.origin.y + 150);
    CGContextAddLineToPoint(context, CGRectGetMaxX(rect) - 16, CGRectGetMaxY(rect) - 16);
    CGContextAddLineToPoint(context, rect.origin.x + 16, CGRectGetMaxY(rect) - 16);
    CGContextClosePath(context);
    CGContextFillPath(context);
    CGContextSetRGBStrokeColor(context, 93.0 / 255.0, 120.0 / 255.0, 1, .3);
    CGContextSetLineWidth(context, 2);
    CGContextBeginPath(context);
    CGContextMoveToPoint(context, rect.origin.x + 16, rect.origin.y + 173);
    CGContextAddCurveToPoint(context, rect.origin.x + 48, rect.origin.y + 150,
                             rect.origin.x + 83, rect.origin.y + 187,
                             CGRectGetMaxX(rect) - 16, rect.origin.y + 165);
    CGContextStrokePath(context);
  } else if (artwork == 1) {
    CGContextSetRGBStrokeColor(context, 246.0 / 255.0, 247.0 / 255.0, 244.0 / 255.0, .09);
    CGContextSetLineWidth(context, 1);
    CGContextStrokeEllipseInRect(context, CGRectMake(centre_x - 46, rect.origin.y + 64, 92, 92));
    CGContextSetRGBStrokeColor(context, 246.0 / 255.0, 247.0 / 255.0, 244.0 / 255.0, .2);
    CGContextSetLineWidth(context, 2);
    CGContextStrokeEllipseInRect(context, CGRectMake(centre_x - 42, rect.origin.y + 68, 84, 84));
    CGContextSetLineWidth(context, 3);
    CGContextBeginPath(context);
    CGContextMoveToPoint(context, centre_x - 12, rect.origin.y + 70);
    CGContextAddLineToPoint(context, centre_x + 6, rect.origin.y + 96);
    CGContextAddLineToPoint(context, centre_x - 6, rect.origin.y + 115);
    CGContextAddLineToPoint(context, centre_x + 12, rect.origin.y + 142);
    CGContextStrokePath(context);
    CGContextSetRGBFillColor(context, 200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, 1);
    CGContextFillEllipseInRect(context, CGRectMake(centre_x - 6, rect.origin.y + 104, 12, 12));
    CGContextSetRGBFillColor(context, 246.0 / 255.0, 247.0 / 255.0, 244.0 / 255.0, .25);
    CGContextFillEllipseInRect(context, CGRectMake(centre_x - 36, rect.origin.y + 80, 3, 3));
    CGContextFillEllipseInRect(context, CGRectMake(centre_x + 29, rect.origin.y + 128, 3, 3));
    CGContextFillEllipseInRect(context, CGRectMake(centre_x + 20, rect.origin.y + 72, 2, 2));
  } else {
    CGContextSetRGBFillColor(context, 5.0 / 255.0, 6.0 / 255.0, 7.0 / 255.0, 1);
    CGContextFillEllipseInRect(context, CGRectMake(centre_x - 29, rect.origin.y + 68, 58, 58));
    CGContextSetRGBStrokeColor(context, 200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, .3);
    CGContextSetLineWidth(context, 2);
    CGContextStrokeEllipseInRect(context, CGRectMake(centre_x - 29, rect.origin.y + 68, 58, 58));
    CGContextSetRGBFillColor(context, 200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, .16);
    CGContextBeginPath(context);
    CGContextMoveToPoint(context, rect.origin.x + 16, CGRectGetMaxY(rect) - 31);
    CGContextAddLineToPoint(context, rect.origin.x + 48, CGRectGetMaxY(rect) - 65);
    CGContextAddLineToPoint(context, rect.origin.x + 72, CGRectGetMaxY(rect) - 41);
    CGContextAddLineToPoint(context, rect.origin.x + 95, CGRectGetMaxY(rect) - 72);
    CGContextAddLineToPoint(context, CGRectGetMaxX(rect) - 16, CGRectGetMaxY(rect) - 28);
    CGContextAddLineToPoint(context, CGRectGetMaxX(rect) - 16, CGRectGetMaxY(rect) - 16);
    CGContextAddLineToPoint(context, rect.origin.x + 16, CGRectGetMaxY(rect) - 16);
    CGContextClosePath(context);
    CGContextFillPath(context);
    CGContextSetRGBStrokeColor(context, 200.0 / 255.0, 243.0 / 255.0, 63.0 / 255.0, .24);
    CGContextSetLineWidth(context, 2);
    CGContextBeginPath(context);
    CGContextMoveToPoint(context, rect.origin.x + 16, CGRectGetMaxY(rect) - 23);
    CGContextAddLineToPoint(context, rect.origin.x + 48, CGRectGetMaxY(rect) - 50);
    CGContextAddLineToPoint(context, rect.origin.x + 72, CGRectGetMaxY(rect) - 32);
    CGContextAddLineToPoint(context, rect.origin.x + 95, CGRectGetMaxY(rect) - 58);
    CGContextAddLineToPoint(context, CGRectGetMaxX(rect) - 16, CGRectGetMaxY(rect) - 20);
    CGContextStrokePath(context);
  }

  CGContextSetRGBStrokeColor(context, border_red / 255.0, border_green / 255.0, border_blue / 255.0, .5);
  CGContextSetLineWidth(context, 2);
  CGContextBeginPath(context);
  CGContextMoveToPoint(context, rect.origin.x + 18, CGRectGetMaxY(rect) - 16);
  CGContextAddLineToPoint(context, rect.origin.x + 53, CGRectGetMaxY(rect) - 16);
  CGContextStrokePath(context);

  CGGradientRelease(gradient);
  CFRelease(colours);
  CGColorRelease(top);
  CGColorRelease(bottom);
  CGColorSpaceRelease(space);
  CGPathRelease(path);
  CGContextRestoreGState(context);
}

static void draw_brand_mark(CGContextRef context) {
  draw_disc(context, 145, 210, 78, 36, 75, 255);
  draw_disc(context, 367, 210, 78, 145, 181, 26);
  draw_disc(context, 256, 190, 92, 133, 139, 136);

  draw_sleeve(context, CGRectMake(76, 226, 150, 204), 15, -.0872665, 0, 17, 26, 46, 36, 75, 255);
  draw_sleeve(context, CGRectMake(286, 226, 150, 204), 15, .0872665, 2, 28, 35, 14, 200, 243, 63);
  draw_sleeve(context, CGRectMake(181, 208, 150, 228), 15, 0, 1, 32, 34, 34, 246, 247, 244);
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
