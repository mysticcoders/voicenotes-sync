// Mock the Obsidian API
export const moment = {
  format: jest.fn((date: any) => date),
  isSame: jest.fn(() => false),
};

export class Notice {
  constructor(public message: string) {}
}

export const normalizePath = (path: string): string => path;

export const requestUrl = jest.fn(async () => ({
  status: 200,
  json: {},
  arrayBuffer: new ArrayBuffer(0),
}));

export class TFile {
  constructor(public path: string, public basename: string) {}
}

export class Vault {
  adapter = {
    exists: jest.fn().mockResolvedValue(false),
    write: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(''),
    writeBinary: jest.fn().mockResolvedValue(undefined),
    readBinary: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
  };

  createFolder = jest.fn().mockResolvedValue(undefined);
  create = jest.fn().mockResolvedValue(undefined);
  modify = jest.fn().mockResolvedValue(undefined);
  delete = jest.fn().mockResolvedValue(undefined);
  getMarkdownFiles = jest.fn().mockReturnValue([]);
  getFileByPath = jest.fn().mockReturnValue(new TFile('path', 'basename'));
}

export class App {
  vault = new Vault();
  metadataCache = {
    on: jest.fn(),
    getFileCache: jest.fn().mockReturnValue({ frontmatter: {} }),
  };
}

export class Plugin {
  app: App;
  manifest: PluginManifest;

  constructor(app: App, manifest: PluginManifest) {
    this.app = app;
    this.manifest = manifest;
  }

  loadData = jest.fn().mockResolvedValue({});
  saveData = jest.fn().mockResolvedValue(undefined);
  registerEvent = jest.fn();
  addCommand = jest.fn();
  addSettingTab = jest.fn();
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description: string;
  author: string;
  authorUrl: string;
  isDesktopOnly: boolean;
}

export class DataAdapter {
  exists = jest.fn().mockResolvedValue(false);
  write = jest.fn().mockResolvedValue(undefined);
  read = jest.fn().mockResolvedValue('');
  writeBinary = jest.fn().mockResolvedValue(undefined);
  readBinary = jest.fn().mockResolvedValue(new ArrayBuffer(0));
}

export class Editor {
  replaceSelection = jest.fn();
}

export class Setting {
  constructor(public containerEl: HTMLElement) {}

  setName = jest.fn().mockReturnThis();
  setDesc = jest.fn().mockReturnThis();
  addText = jest.fn().mockReturnThis();
  addTextArea = jest.fn().mockReturnThis();
  addToggle = jest.fn().mockReturnThis();
  addButton = jest.fn().mockReturnThis();
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {}
}