import { readFileSync } from 'fs';

async function main() {
  const file = readFileSync('D:/NCKH/dulieu.xlsx');
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  
  const prefix = Buffer.from(
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="file"; filename="dulieu.xlsx"\r\n' +
    'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'
  );
  const suffix = Buffer.from('\r\n--' + boundary + '--\r\n');
  const body = Buffer.concat([prefix, file, suffix]);

  const res = await fetch('http://localhost:4000/excel/workbook/import/8be0ee8e-9955-4da2-9876-eb28814ca221', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary },
    body: body
  });
  
  console.log('Status:', res.status);
  const text = await res.text();
  console.log(text.substring(0, 3000));
}

main().catch(console.error);
