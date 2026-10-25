/**
 * Runtime configuration for the UI.
 *
 * This file is loaded before the other browser scripts so that the values
 * defined here are available to the application at startup.
 *
 * API_BASE_URL
 *   Base URL of the backend API service. It may be an absolute URL
 *   (e.g. "https://api.example.com") or a path relative to the UI origin
 *   (e.g. "/api"). When left empty, the UI falls back to the same origin
 *   it was served from, preserving the previous behaviour.
 *
 * To point the UI at a different backend, edit this value (or replace this
 * file during deployment) — no code change or rebuild is required.
 */
window.API_BASE_URL = window.API_BASE_URL || "";