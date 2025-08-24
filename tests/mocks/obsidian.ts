import { mock } from 'jest-mock-extended';

// Mock Obsidian's requestUrl function
export const requestUrl = jest.fn();

// Mock DataAdapter
export class DataAdapter {
  writeBinary = jest.fn();
  write = jest.fn();
  read = jest.fn();
  exists = jest.fn();
  createFolder = jest.fn();
  remove = jest.fn();
}

// Mock Notice
export class Notice {
  constructor(public message: string) {}
}

// Mock other commonly used Obsidian exports
export const normalizePath = jest.fn((path: string) => path);
export const moment = jest.fn();

// Mock Plugin base class
export class Plugin {
  app: any;
  manifest: any;
  
  constructor(app: any, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }
  
  loadData = jest.fn();
  saveData = jest.fn();
}

// Mock PluginSettingTab
export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: HTMLElement;
  
  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }
  
  display = jest.fn();
}

// Mock Setting
export class Setting {
  containerEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.nameEl = document.createElement('div');
    this.descEl = document.createElement('div');
  }
  
  setName = jest.fn().mockReturnThis();
  setDesc = jest.fn().mockReturnThis();
  addText = jest.fn().mockReturnThis();
  addTextArea = jest.fn().mockReturnThis();
  addToggle = jest.fn().mockReturnThis();
  addButton = jest.fn().mockReturnThis();
}

// Mock RequestUrlParam and RequestUrlResponse types
export interface RequestUrlParam {
  url: string;
  method?: string;
  contentType?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer;
}

export interface RequestUrlResponse {
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
  json: any;
  text: string;
}