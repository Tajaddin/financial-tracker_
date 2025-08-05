const csv = require('csv-parser');
const fs = require('fs');
const XLSX = require('xlsx');
const pdf = require('pdf-parse');

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

const parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

const parsePDF = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  // Basic parsing - you'll need to implement specific logic based on your bank's format
  return data.text;
};

const parseStatement = async (filePath, fileType) => {
  switch (fileType) {
    case 'csv':
      return parseCSV(filePath);
    case 'xlsx':
    case 'xls':
      return parseExcel(filePath);
    case 'pdf':
      return parsePDF(filePath);
    default:
      throw new Error('Unsupported file type');
  }
};

module.exports = { parseStatement };