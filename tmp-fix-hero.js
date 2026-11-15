const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const source = 'file:///E:/h2hcombined/h2houseofhealth.github.io/cdn/shop/files/hero/h2-merch-hero-editorial.png';
  await page.goto(source);
  const png = await page.evaluate(() => new Promise((resolve) => {
    const image = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    function repair(x, y, width, height, label, font, textY, sourceYOffset) {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = pixels.data;
      for (let row = y; row < y + height; row += 1) {
        for (let col = x; col < x + width; col += 1) {
          const from = ((row + sourceYOffset) * canvas.width + col) * 4;
          const to = (row * canvas.width + col) * 4;
          data[to] = data[from]; data[to + 1] = data[from + 1]; data[to + 2] = data[from + 2]; data[to + 3] = data[from + 3];
        }
      }
      ctx.putImageData(pixels, 0, 0);
      ctx.save();
      ctx.font = font;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + width / 2, textY);
      ctx.restore();
    }

    repair(670, 260, 60, 40, 'H₂', '20px Arial', 280, -40);
    repair(815, 384, 70, 40, 'H₂', '17px Arial', 404, -40);
    repair(1135, 376, 90, 40, 'H₂', '17px Arial', 396, -40);
    resolve(canvas.toDataURL('image/png').split(',')[1]);
  }));
  fs.writeFileSync('cdn/shop/files/hero/h2-merch-hero-editorial.png', Buffer.from(png, 'base64'));
  await browser.close();
})();
