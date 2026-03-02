import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

// Google Sheets API configuration
export const googleSheetsConfig = {
  // You need to set up Google Cloud Console and get these credentials
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback',
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly'
  ]
};

// Create OAuth2 client
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    googleSheetsConfig.clientId,
    googleSheetsConfig.clientSecret,
    googleSheetsConfig.redirectUri
  );
}

// Create Sheets client
export function createSheetsClient(auth: OAuth2Client) {
  return google.sheets({ version: 'v4', auth });
}

// Create Drive client
export function createDriveClient(auth: OAuth2Client) {
  return google.drive({ version: 'v3', auth });
}

// Extract spreadsheet ID from various Google Sheets link formats
export function extractSpreadsheetIdFromLink(link: string): string | null {
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)\/edit/,
    /\/d\/([a-zA-Z0-9-_]+)\/view/,
    /id=([a-zA-Z0-9-_]+)/
  ];

  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Get spreadsheet metadata
export async function getSpreadsheetMetadata(spreadsheetId: string, auth: OAuth2Client) {
  try {
    const sheets = createSheetsClient(auth);
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [],
      includeGridData: false
    });
    return response.data;
  } catch (error) {
    console.error('Error getting spreadsheet metadata:', error);
    return null;
  }
}

// Read data from spreadsheet
export async function readSpreadsheetData(spreadsheetId: string, range: string, auth: OAuth2Client) {
  try {
    const sheets = createSheetsClient(auth);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    return response.data.values || [];
  } catch (error) {
    console.error('Error reading spreadsheet data:', error);
    return null;
  }
}

// Get all sheet names from spreadsheet
export async function getSheetNames(spreadsheetId: string, auth: OAuth2Client) {
  try {
    const sheets = createSheetsClient(auth);
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [],
      includeGridData: false
    });
    return response.data.sheets?.map(sheet => sheet.properties?.title) || [];
  } catch (error) {
    console.error('Error getting sheet names:', error);
    return [];
  }
}

// Convert spreadsheet data to JSON objects
export function convertSheetDataToJSON(data: (string | number | boolean | null)[][]) {
  if (!data || data.length === 0) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    const obj: Record<string, string | number | boolean | null> = {};
    headers.forEach((header, index) => {
      if (header && row[index] !== undefined) {
        obj[String(header)] = row[index];
      }
    });
    return obj;
  });
}

// Get file metadata from Drive
export async function getFileMetadata(fileId: string, auth: OAuth2Client) {
  try {
    const drive = createDriveClient(auth);
    const response = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,size,modifiedTime'
    });
    return response.data;
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return null;
  }
}

// Download file content
export async function downloadFile(fileId: string, auth: OAuth2Client) {
  try {
    const drive = createDriveClient(auth);
    const response = await drive.files.get({
      fileId,
      alt: 'media'
    });
    return response.data;
  } catch (error) {
    console.error('Error downloading file:', error);
    return null;
  }
}

// List files in a folder
export async function listFilesInFolder(folderId: string, auth: OAuth2Client) {
  try {
    const drive = createDriveClient(auth);
    const response = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      orderBy: 'modifiedTime desc'
    });
    return response.data.files || [];
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
}

// Search files by name
export async function searchFilesByName(fileName: string, auth: OAuth2Client) {
  try {
    const drive = createDriveClient(auth);
    const response = await drive.files.list({
      q: `name contains '${fileName}'`,
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      orderBy: 'modifiedTime desc'
    });
    return response.data.files || [];
  } catch (error) {
    console.error('Error searching files:', error);
    return [];
  }
}

