from yolo import YOLO
from PIL import Image

yolo = YOLO()

def draw_bbox(image, ret):
    font = ImageFont.truetype(font='font/FiraMono-Medium.otf',
                size=np.floor(6e-2 * image.size[1] + 0.5).astype('int32'))
    thickness = (image.size[0] + image.size[1]) // 100

    for r in ret:
        label = r['label']
        c = r['label_id']
        draw = ImageDraw.Draw(image)
        label_size = draw.textsize(label, font)

        top = r['rect']['min_y']
        bottom = r['rect']['max_y']
        left = r['rect']['min_x']
        right = r['rect']['max_x']

        if top - label_size[1] >= 0:
            text_origin = np.array([left, top - label_size[1]])
        else:
            text_origin = np.array([left, top + 1])

        # My kingdom for a good redistributable image drawing library.
        for i in range(thickness):
            draw.rectangle(
                [left + i, top + i, right - i, bottom - i],
                outline=yolo.colors[c])
        draw.rectangle(
            [tuple(text_origin), tuple(text_origin + label_size)],
            fill=yolo.colors[c])
        draw.text(text_origin, label, fill=(0, 0, 0), font=font)
        del draw

def handler(_iter, ctx):
    for img in _iter:
        img = Image.fromarray(img)
        ret = yolo.detect_image(img)
        
        draw_bbox(img, ret)

        output = io.BytesIO()
        img.save(output, format='JPEG')
        bimg = output.getvalue()

        yield Response([bimg], metadata=[('Content-Type', 'image/jpeg')])
