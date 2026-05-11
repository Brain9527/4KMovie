const XLSX = require('xlsx');
const path = require('path');

const data = [
  ['电影名', '中文名', '磁力'],
  ['Inception', '盗梦空间', 'magnet:?xt=urn:btih:inception123'],
  ['The Dark Knight', '蝙蝠侠：黑暗骑士', 'magnet:?xt=urn:btih:darkknight456'],
  ['Interstellar', '星际穿越', 'magnet:?xt=urn:btih:interstellar789'],
  ['The Matrix', '黑客帝国', 'magnet:?xt=urn:btih:matrix000'],
  ['Pulp Fiction', '低俗小说', 'magnet:?xt=urn:btih:pulpfiction111']
];

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Movies');

const filePath = path.join(__dirname, 'public/data/movies.xls');
XLSX.writeFile(wb, filePath);

console.log('Sample Excel file created at:', filePath);
