/**
 * Manifest V3 service worker.
 * Handles extension lifecycle, alarms for recurring reminders,
 * and message routing between popup / dashboard.
 * No remote code execution. No network requests for core functionality.
 */

import { ensureInitialized } from '../storage/storage';

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureInitialized();
  if (details.reason === 'install') {
    console.info('[Finance Intelligence] Extension installed. Local storage initialized.');
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Simple message bus for UI components
  if (message?.type === 'PING') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return true;
  }
  if (message?.type === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

// Optional: daily alarm for upcoming recurring payments (local only)
chrome.alarms?.create?.('daily-check', { periodInMinutes: 60 * 24 });
chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm.name === 'daily-check') {
    // Future: evaluate recurring payments and show badge / notification
    // Notifications would require "notifications" permission and explicit user consent.
  }
});
