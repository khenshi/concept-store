"""Run with python3 -m unittest frontend/src/app/themes-contrast.test.py."""
import re
import unittest
from pathlib import Path

CSS = Path(__file__).with_name('themes.css').read_text()
EXPECTED = {'GRAPHITE','OCEAN','FOREST','PLUM','POLLUX_LIGHT','SKYDASH_LIGHT','STAR_ADMIN_LIGHT','AZIA_LIGHT','PURPLE_LIGHT','PLUS_ADMIN_LIGHT','BREEZE_LIGHT','STELLAR_DARK','CORONA_DARK','JUSTDO_DARK','SYPHER_LIGHT','CREXTIO_WARM','SBB_INDUSTRIAL','WELLNESS_TEAL'}
TOKENS = {'canvas','surface','subtle','hover','ink','muted','faint','hairline','border-strong','control-border','action','action-hover','action-foreground','accent','accent-hover','accent-soft','selected','selected-border','focus','success','success-ink','warning','danger','danger-foreground','info','scrim'}

def luminance(value):
    if len(value) == 4:
        value = '#' + ''.join(c * 2 for c in value[1:])
    values = [int(value[i:i+2],16)/255 for i in (1,3,5)]
    linear = [x/12.92 if x <= .04045 else ((x+.055)/1.055)**2.4 for x in values]
    return sum(x*y for x,y in zip(linear,(.2126,.7152,.0722)))

def contrast(a,b):
    low,high = sorted((luminance(a),luminance(b)))
    return (high+.05)/(low+.05)

class ThemeContrastTest(unittest.TestCase):
    def test_palettes(self):
        blocks = {}
        for selector, block in re.findall(r"((?::root,\s*)?(?:\[data-color-theme='[^']+'\],?\s*)+)\{([^}]+)\}", CSS):
            for name in re.findall(r"data-color-theme='([^']+)'", selector):
                blocks[name] = block
        self.assertEqual(set(blocks), EXPECTED)
        for name, block in blocks.items():
            with self.subTest(theme=name):
                colors = dict(re.findall(r'--color-([\w-]+):\s*([^;]+);',block))
                self.assertEqual(set(colors), TOKENS)
                for foreground in ('ink','muted','faint','success-ink','warning','danger','info','accent'):
                    for background in ('canvas','surface','subtle','selected'):
                        self.assertGreaterEqual(contrast(colors[foreground],colors[background]),4.5,(name,foreground,background))
                for foreground,background in (('action-foreground','action'),('action-foreground','action-hover'),('danger-foreground','danger')):
                    self.assertGreaterEqual(contrast(colors[foreground],colors[background]),4.5,(name,foreground,background))
                for foreground,background in (('control-border','surface'),('selected-border','selected'),('focus','surface')):
                    self.assertGreaterEqual(contrast(colors[foreground],colors[background]),3,(name,foreground,background))

if __name__ == '__main__':
    unittest.main()
