import { resolvePublicBaseUrl } from './public-base-url';

describe('resolvePublicBaseUrl', () => {
  it('dùng biến môi trường khi nó trỏ ra ngoài', () => {
    expect(resolvePublicBaseUrl('https://gettimetable.cloud', 'https://khac.example')).toBe('https://gettimetable.cloud');
  });

  it('bỏ dấu gạch chéo thừa ở cuối', () => {
    expect(resolvePublicBaseUrl('https://gettimetable.cloud///')).toBe('https://gettimetable.cloud');
  });

  it('quên khai biến trên máy chủ thì lấy địa chỉ trình duyệt vừa gọi tới', () => {
    expect(resolvePublicBaseUrl('http://localhost:3000', 'https://gettimetable.cloud')).toBe('https://gettimetable.cloud');
    expect(resolvePublicBaseUrl(undefined, 'https://gettimetable.cloud')).toBe('https://gettimetable.cloud');
  });

  it('máy dev vẫn ra localhost, không bị đẩy sang tên miền thật', () => {
    expect(resolvePublicBaseUrl('http://localhost:3000', 'http://localhost:3000')).toBe('http://localhost:3000');
    expect(resolvePublicBaseUrl('http://127.0.0.1:3001', undefined)).toBe('http://127.0.0.1:3001');
    expect(resolvePublicBaseUrl(undefined, undefined)).toBe('http://localhost:3000');
  });
});
