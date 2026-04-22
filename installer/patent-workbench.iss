; ============================================================
; Patent Workbench — Inno Setup installer wizard
;
; Prerequisites handled inside the wizard:
;   • Node.js v24.x  (via winget — OpenJS.NodeJS.LTS)
;   • Ollama          (via winget — Ollama.Ollama)
;   • LLM model pull  (interactive selection + background pull)
;
; Source: dist-electron\win-unpacked\   (electron-builder dir output)
; Output: installer\output\PatentWorkbench-{version}-Setup.exe
;
; Compile with Inno Setup 6.3+:
;   iscc.exe installer\patent-workbench.iss
; ============================================================

#define AppName      "Patent Workbench"
#define AppVersion   "2.1.4"
#define AppPublisher "Patent Workbench"
#define AppURL       "https://github.com/jhonatan-saints/patent-workbench"
#define AppExeName   "patent_workbench.exe"

; Source tree produced by electron-builder (relative to project root)
#define SrcDir "..\dist-electron\win-unpacked"

[Setup]
AppId={{7A3F1B2C-4D5E-6F70-8192-A3B4C5D6E7F8}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={sd}\{#AppName}
DefaultGroupName={#AppName}
PrivilegesRequired=admin
OutputDir=output
OutputBaseFilename=PatentWorkbench-setup
SetupIconFile=..\build\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
DisableWelcomePage=no
DisableDirPage=no
DisableReadyPage=no
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\{#AppExeName}
; Code-signing (uncomment and configure in CI with certificate):
; SignTool=signtool
; SignedUninstaller=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
; ── Welcome page ──
WelcomeLabel2=This wizard will install {#AppName} {#AppVersion} on your computer.%n%nThe installer will check for Node.js and Ollama and install them if missing. An LLM model will be configured for offline use.%n%nClick Next to continue.

; ── Node.js page ──
NodePageCaption=Node.js Runtime
NodePageDescription=Checking for Node.js v24 or later.
NodeFound=Node.js %1 detected.
NodeMissing=Node.js was not found. The installer will download and install it automatically.
NodeInstalling=Installing Node.js via winget...
NodeInstallFailed=Node.js installation failed. Please install Node.js v24 manually from https://nodejs.org and re-run this installer.

; ── Ollama page ──
OllamaPageCaption=Ollama (Local LLM Runtime)
OllamaPageDescription=Checking for Ollama.
OllamaFound=Ollama is already installed.
OllamaMissing=Ollama was not found. The installer will download and install it automatically.
OllamaInstalling=Installing Ollama via winget...
OllamaInstallFailed=Ollama installation failed. Please install Ollama manually from https://ollama.com and re-run this installer.

; ── Model page ──
ModelPageCaption=Language Model
ModelPageDescription=Select the LLM model that Patent Workbench will use to generate patent text.
ModelLocalFound=The following models were detected on this machine. Select one to use.
ModelNoneFound=No local models found. Select a model to download (an internet connection is required).
ModelPulling=Downloading model "%1". This may take several minutes...
ModelPullDone=Model "%1" is ready.
ModelPullFailed=Model download failed. You can pull a model manually after installation with: ollama pull <model>

; ── Configuration page ──
ConfigPageCaption=Initial Configuration
ConfigPageDescription=Set your preferences. These can be changed at any time from the application Settings panel.
ConfigOllamaURL=Ollama server URL
ConfigLanguage=Interface language
ConfigNumOptions=Options generated per step (1–5)

; ── Installing page ──
InstallingMsg=Copying files and creating shortcuts...

; ── Done page ──
DoneLabel=Patent Workbench has been installed successfully.%n%nClick Finish to launch the application.

[Dirs]
Name: "{app}\data"
Name: "{app}\logs"
Name: "{app}\config"

[Files]
Source: "{#SrcDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\{#AppName}";           Filename: "{app}\{#AppExeName}"
Name: "{userprograms}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#AppName}";            Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent

; ==============================================================
; Pascal script — custom wizard pages and prerequisite handling
; ==============================================================
[Code]

const
  NODE_WINGET_ID   = 'OpenJS.NodeJS.LTS';
  OLLAMA_WINGET_ID = 'Ollama.Ollama';
  MIN_NODE_MAJOR   = 24;

var
  // Curated model list (initialized in InitializeWizard — typed array consts
  // are not supported by Inno Setup Pascal Script)
  CURATED_MODELS:    array of string;
  CURATED_MODEL_IDS: array of string;
  SUPPORTED_LANGS:   array of string;

  // Pages
  PageNode:       TWizardPage;
  PageOllama:     TWizardPage;
  PageModel:      TWizardPage;
  PageConfig:     TWizardPage;

  // Node page controls
  LblNodeStatus:  TLabel;
  BarNode:        TNewProgressBar;
  LblNodePct:     TLabel;

  // Ollama page controls
  LblOllamaStatus: TLabel;
  BarOllama:       TNewProgressBar;
  LblOllamaPct:    TLabel;

  // Model page controls
  LblModelHint:   TLabel;
  LstModels:      TListBox;
  BarModel:       TNewProgressBar;
  LblModelPct:    TLabel;

  // Config page controls
  EdtOllamaURL:   TEdit;
  CboLanguage:    TComboBox;
  CboNumOptions:  TComboBox;

  // Runtime state
  LocalModels:    TStringList;
  SelectedModel:  string;
  NodeVersion:    string;
  OllamaPresent:  Boolean;

// Utilities

// Runs a command and captures stdout. Returns exit code.
function ExecCapture(const Cmd, Params: string; var Output: string): Integer;
var
  TmpFile, WrappedCmd: string;
  AnsiOut: AnsiString;
  ExitCode: Integer;
begin
  TmpFile    := ExpandConstant('{tmp}\pw_capture.txt');
  WrappedCmd := '/C "' + Cmd + ' ' + Params + ' > "' + TmpFile + '" 2>&1"';
  ExitCode   := 0;
  Exec(ExpandConstant('{sys}\cmd.exe'), WrappedCmd, '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  if FileExists(TmpFile) then
  begin
    LoadStringFromFile(TmpFile, AnsiOut);
    Output := String(AnsiOut);
  end;
  Result := ExitCode;
end;

// Runs winget silently. Returns true on success.
function WingetInstall(const PackageId: string): Boolean;
var
  ExitCode: Integer;
begin
  Exec(
    ExpandConstant('{sys}\cmd.exe'),
    '/C winget install --id ' + PackageId + ' --silent --accept-package-agreements --accept-source-agreements',
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode
  );
  Result := (ExitCode = 0);
end;

// Parses "v24.1.0" → major integer. Returns -1 on failure.
function ParseNodeMajor(const VerStr: string): Integer;
var
  S: string;
  DotPos: Integer;
begin
  S := VerStr;
  if (Length(S) > 0) and (S[1] = 'v') then
    Delete(S, 1, 1);
  DotPos := Pos('.', S);
  if DotPos > 1 then
    Result := StrToIntDef(Copy(S, 1, DotPos - 1), -1)
  else
    Result := StrToIntDef(S, -1);
end;

// Node.js detection & install

function DetectNode: Boolean;
var
  Output: string;
begin
  ExecCapture('node', '--version', Output);
  Output      := Trim(Output);
  NodeVersion := Output;
  Result      := (ParseNodeMajor(Output) >= MIN_NODE_MAJOR);
end;

// Ollama detection & install

function DetectOllama: Boolean;
var
  ExitCode: Integer;
begin
  Exec(
    ExpandConstant('{sys}\cmd.exe'),
    '/C where ollama >nul 2>&1',
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode
  );
  Result := (ExitCode = 0);
end;

// Model helpers

// Runs "ollama list" and populates LocalModels (one model ID per line).
procedure PopulateLocalModels;
var
  Output, Line: string;
  Lines: TStringList;
  I: Integer;
  Parts: TStringList;
begin
  LocalModels := TStringList.Create;
  ExecCapture('ollama', 'list', Output);
  Lines := TStringList.Create;
  Lines.Text := Output;
  // First line is the header — skip it.
  for I := 1 to Lines.Count - 1 do
  begin
    Line := Trim(Lines[I]);
    if Line = '' then Continue;
    // First token is the model name (tab/space separated columns).
    Parts := TStringList.Create;
    Parts.Delimiter      := ' ';
    Parts.StrictDelimiter := False;
    Parts.DelimitedText  := Line;
    if Parts.Count > 0 then
      LocalModels.Add(Parts[0]);
    Parts.Free;
  end;
  Lines.Free;
end;

// Progress helpers

procedure SetProgress(Bar: TNewProgressBar; LblPct: TLabel; Pct: Integer);
begin
  Bar.Position   := Pct;
  LblPct.Caption := IntToStr(Pct) + '%';
end;

// Page builders

procedure CreateNodePage;
begin
  PageNode := CreateCustomPage(
    wpWelcome,
    CustomMessage('NodePageCaption'),
    CustomMessage('NodePageDescription')
  );

  LblNodeStatus              := TLabel.Create(PageNode);
  LblNodeStatus.Parent       := PageNode.Surface;
  LblNodeStatus.AutoSize     := False;
  LblNodeStatus.Left         := 0;
  LblNodeStatus.Top          := 8;
  LblNodeStatus.Width        := 400;
  LblNodeStatus.Height       := 48;
  LblNodeStatus.WordWrap     := True;
  LblNodeStatus.Caption      := '';

  BarNode             := TNewProgressBar.Create(PageNode);
  BarNode.Parent      := PageNode.Surface;
  BarNode.Left        := 0;
  BarNode.Top         := 64;
  BarNode.Width       := PageNode.SurfaceWidth;
  BarNode.Height      := 18;
  BarNode.Min         := 0;
  BarNode.Max         := 100;
  BarNode.Position    := 0;
  BarNode.Visible     := False;

  LblNodePct          := TLabel.Create(PageNode);
  LblNodePct.Parent   := PageNode.Surface;
  LblNodePct.AutoSize := False;
  LblNodePct.Left     := 0;
  LblNodePct.Top      := BarNode.Top + 24;
  LblNodePct.Width    := PageNode.SurfaceWidth;
  LblNodePct.Height   := 18;
  LblNodePct.Caption  := '';
  LblNodePct.Visible  := False;
end;

procedure CreateOllamaPage;
begin
  PageOllama := CreateCustomPage(
    PageNode.ID,
    CustomMessage('OllamaPageCaption'),
    CustomMessage('OllamaPageDescription')
  );

  LblOllamaStatus              := TLabel.Create(PageOllama);
  LblOllamaStatus.Parent       := PageOllama.Surface;
  LblOllamaStatus.AutoSize     := False;
  LblOllamaStatus.Left         := 0;
  LblOllamaStatus.Top          := 8;
  LblOllamaStatus.Width        := 400;
  LblOllamaStatus.Height       := 48;
  LblOllamaStatus.WordWrap     := True;
  LblOllamaStatus.Caption      := '';

  BarOllama             := TNewProgressBar.Create(PageOllama);
  BarOllama.Parent      := PageOllama.Surface;
  BarOllama.Left        := 0;
  BarOllama.Top         := 64;
  BarOllama.Width       := PageOllama.SurfaceWidth;
  BarOllama.Height      := 18;
  BarOllama.Min         := 0;
  BarOllama.Max         := 100;
  BarOllama.Position    := 0;
  BarOllama.Visible     := False;

  LblOllamaPct          := TLabel.Create(PageOllama);
  LblOllamaPct.Parent   := PageOllama.Surface;
  LblOllamaPct.AutoSize := False;
  LblOllamaPct.Left     := 0;
  LblOllamaPct.Top      := BarOllama.Top + 24;
  LblOllamaPct.Width    := PageOllama.SurfaceWidth;
  LblOllamaPct.Height   := 18;
  LblOllamaPct.Caption  := '';
  LblOllamaPct.Visible  := False;
end;

procedure CreateModelPage;
begin
  PageModel := CreateCustomPage(
    PageOllama.ID,
    CustomMessage('ModelPageCaption'),
    CustomMessage('ModelPageDescription')
  );

  LblModelHint              := TLabel.Create(PageModel);
  LblModelHint.Parent       := PageModel.Surface;
  LblModelHint.AutoSize     := False;
  LblModelHint.Left         := 0;
  LblModelHint.Top          := 0;
  LblModelHint.Width        := 400;
  LblModelHint.Height       := 20;
  LblModelHint.Caption      := '';

  LstModels                 := TListBox.Create(PageModel);
  LstModels.Parent          := PageModel.Surface;
  LstModels.Left            := 0;
  LstModels.Top             := 24;
  LstModels.Width           := WizardForm.InnerNotebook.Width;
  LstModels.Height          := PageModel.SurfaceHeight - 66;
  LstModels.TabStop         := True;

  BarModel             := TNewProgressBar.Create(PageModel);
  BarModel.Parent      := PageModel.Surface;
  BarModel.Left        := 0;
  BarModel.Top         := PageModel.SurfaceHeight - 36;
  BarModel.Width       := PageModel.SurfaceWidth;
  BarModel.Height      := 18;
  BarModel.Min         := 0;
  BarModel.Max         := 100;
  BarModel.Position    := 0;
  BarModel.Visible     := False;

  LblModelPct          := TLabel.Create(PageModel);
  LblModelPct.Parent   := PageModel.Surface;
  LblModelPct.AutoSize := False;
  LblModelPct.Left     := 0;
  LblModelPct.Top      := BarModel.Top - 18;
  LblModelPct.Width    := PageModel.SurfaceWidth;
  LblModelPct.Height   := 16;
  LblModelPct.Caption  := '';
  LblModelPct.Visible  := False;
end;

procedure CreateConfigPage;
var
  LblURL, LblLang, LblOpts: TLabel;
  I: Integer;
begin
  PageConfig := CreateCustomPage(
    PageModel.ID,
    CustomMessage('ConfigPageCaption'),
    CustomMessage('ConfigPageDescription')
  );

  // Ollama URL
  LblURL              := TLabel.Create(PageConfig);
  LblURL.Parent       := PageConfig.Surface;
  LblURL.Left         := 0;
  LblURL.Top          := 0;
  LblURL.Caption      := CustomMessage('ConfigOllamaURL') + ':';

  EdtOllamaURL              := TEdit.Create(PageConfig);
  EdtOllamaURL.Parent       := PageConfig.Surface;
  EdtOllamaURL.Left         := 0;
  EdtOllamaURL.Top          := 18;
  EdtOllamaURL.Width        := PageConfig.SurfaceWidth;
  EdtOllamaURL.Text         := 'http://localhost:11434';

  // Language
  LblLang              := TLabel.Create(PageConfig);
  LblLang.Parent       := PageConfig.Surface;
  LblLang.Left         := 0;
  LblLang.Top          := 52;
  LblLang.Caption      := CustomMessage('ConfigLanguage') + ':';

  CboLanguage                    := TComboBox.Create(PageConfig);
  CboLanguage.Parent             := PageConfig.Surface;
  CboLanguage.Left               := 0;
  CboLanguage.Top                := 70;
  CboLanguage.Width              := 180;
  CboLanguage.Style              := csDropDownList;
  for I := 0 to GetArrayLength(SUPPORTED_LANGS) - 1 do
    CboLanguage.Items.Add(SUPPORTED_LANGS[I]);
  CboLanguage.ItemIndex := 0; // en-US

  // Num options
  LblOpts              := TLabel.Create(PageConfig);
  LblOpts.Parent       := PageConfig.Surface;
  LblOpts.Left         := 0;
  LblOpts.Top          := 106;
  LblOpts.Caption      := CustomMessage('ConfigNumOptions') + ':';

  CboNumOptions                    := TComboBox.Create(PageConfig);
  CboNumOptions.Parent             := PageConfig.Surface;
  CboNumOptions.Left               := 0;
  CboNumOptions.Top                := 124;
  CboNumOptions.Width              := 80;
  CboNumOptions.Style              := csDropDownList;
  CboNumOptions.Items.Add('1');
  CboNumOptions.Items.Add('2');
  CboNumOptions.Items.Add('3');
  CboNumOptions.Items.Add('4');
  CboNumOptions.Items.Add('5');
  CboNumOptions.ItemIndex := 2; // default: 3
end;

// Init

procedure InitializeWizard;
begin
  SetArrayLength(CURATED_MODELS, 5);
  CURATED_MODELS[0] := 'qwen2.5:7b — Recommended (balanced speed / quality)';
  CURATED_MODELS[1] := 'qwen2.5:3b — Lightweight (~2 GB)';
  CURATED_MODELS[2] := 'llama3.2:3b — Fast (~2 GB)';
  CURATED_MODELS[3] := 'mistral:7b — Strong structured output (~4 GB)';
  CURATED_MODELS[4] := 'phi4:14b   — Highest quality (~8 GB RAM needed)';

  SetArrayLength(CURATED_MODEL_IDS, 5);
  CURATED_MODEL_IDS[0] := 'qwen2.5:7b';
  CURATED_MODEL_IDS[1] := 'qwen2.5:3b';
  CURATED_MODEL_IDS[2] := 'llama3.2:3b';
  CURATED_MODEL_IDS[3] := 'mistral:7b';
  CURATED_MODEL_IDS[4] := 'phi4:14b';

  SetArrayLength(SUPPORTED_LANGS, 16);
  SUPPORTED_LANGS[0]  := 'en-US';  SUPPORTED_LANGS[1]  := 'en-GB';
  SUPPORTED_LANGS[2]  := 'de-DE';  SUPPORTED_LANGS[3]  := 'fr-FR';
  SUPPORTED_LANGS[4]  := 'fr-CA';  SUPPORTED_LANGS[5]  := 'es-ES';
  SUPPORTED_LANGS[6]  := 'es-CL';  SUPPORTED_LANGS[7]  := 'pt-BR';
  SUPPORTED_LANGS[8]  := 'pt-PT';  SUPPORTED_LANGS[9]  := 'it-IT';
  SUPPORTED_LANGS[10] := 'nl';     SUPPORTED_LANGS[11] := 'nb-NO';
  SUPPORTED_LANGS[12] := 'sv-SE';  SUPPORTED_LANGS[13] := 'ru-RU';
  SUPPORTED_LANGS[14] := 'zh-CN';  SUPPORTED_LANGS[15] := 'cy-GB';

  CreateNodePage;
  CreateOllamaPage;
  CreateModelPage;
  CreateConfigPage;
end;

// Page activation (runs checks when the user arrives on each page)

procedure CurPageChanged(CurPageID: Integer);
var
  I: Integer;
begin
  // Node.js page
  if CurPageID = PageNode.ID then
  begin
    WizardForm.NextButton.Enabled := False;
    BarNode.Visible    := False;
    LblNodePct.Visible := False;
    LblNodeStatus.Caption := '';

    if DetectNode then
    begin
      LblNodeStatus.Caption := FmtMessage(CustomMessage('NodeFound'), [NodeVersion]);
      WizardForm.NextButton.Enabled := True;
    end
    else
    begin
      LblNodeStatus.Caption := CustomMessage('NodeMissing') + #13#10 + CustomMessage('NodeInstalling');
      BarNode.Visible := True;
      if WingetInstall(NODE_WINGET_ID) and DetectNode then
      begin
        BarNode.Visible := False;
        LblNodeStatus.Caption := FmtMessage(CustomMessage('NodeFound'), [NodeVersion]);
        WizardForm.NextButton.Enabled := True;
      end
      else
      begin
        BarNode.Visible := False;
        LblNodeStatus.Caption := CustomMessage('NodeInstallFailed');
        // Leave Next disabled — user must resolve manually.
      end;
    end;
  end;

  // Ollama page
  if CurPageID = PageOllama.ID then
  begin
    WizardForm.NextButton.Enabled := False;
    BarOllama.Visible    := False;
    LblOllamaPct.Visible := False;
    LblOllamaStatus.Caption := '';
    OllamaPresent := DetectOllama;

    if OllamaPresent then
    begin
      LblOllamaStatus.Caption := CustomMessage('OllamaFound');
      WizardForm.NextButton.Enabled := True;
    end
    else
    begin
      LblOllamaStatus.Caption := CustomMessage('OllamaMissing') + #13#10 + CustomMessage('OllamaInstalling');
      BarOllama.Visible := True;
      if WingetInstall(OLLAMA_WINGET_ID) then
      begin
        OllamaPresent           := True;
        BarOllama.Visible       := False;
        LblOllamaStatus.Caption := CustomMessage('OllamaFound');
        WizardForm.NextButton.Enabled := True;
      end
      else
      begin
        BarOllama.Visible       := False;
        LblOllamaStatus.Caption := CustomMessage('OllamaInstallFailed');
      end;
    end;
  end;

  // Model page — just populate list, progress bar only appears during pull (NextButtonClick)
  if CurPageID = PageModel.ID then
  begin
    BarModel.Visible    := False;
    LblModelPct.Visible := False;
    LstModels.Items.Clear;
    PopulateLocalModels;

    if LocalModels.Count > 0 then
    begin
      LblModelHint.Caption := CustomMessage('ModelLocalFound');
      for I := 0 to LocalModels.Count - 1 do
        LstModels.Items.Add(LocalModels[I]);
      LstModels.ItemIndex := 0;
    end
    else
    begin
      LblModelHint.Caption := CustomMessage('ModelNoneFound');
      for I := 0 to GetArrayLength(CURATED_MODELS) - 1 do
        LstModels.Items.Add(CURATED_MODELS[I]);
      LstModels.ItemIndex := 0;
    end;
  end;
end;

// Validation before leaving each page

function NextButtonClick(CurPageID: Integer): Boolean;
var
  SelIdx: Integer;
  ModelId, PullOutput: string;
begin
  Result := True;

  // Model page — pull model if not already local
  if CurPageID = PageModel.ID then
  begin
    SelIdx := LstModels.ItemIndex;
    if SelIdx < 0 then
    begin
      MsgBox('Please select a model before continuing.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    if LocalModels.Count > 0 then
      ModelId := LocalModels[SelIdx]
    else
      ModelId := CURATED_MODEL_IDS[SelIdx];

    SelectedModel := ModelId;

    // If the model is already local, skip the pull.
    if LocalModels.IndexOf(ModelId) >= 0 then
      Exit;

    // Pull the model — this is blocking and can take several minutes.
    WizardForm.NextButton.Enabled := False;
    LblModelHint.Caption := FmtMessage(CustomMessage('ModelPulling'), [ModelId]);
    LstModels.Enabled := False;

    BarModel.Position   := 0;
    BarModel.Visible    := True;
    LblModelPct.Caption := '0%';
    LblModelPct.Visible := True;
    SetProgress(BarModel, LblModelPct, 10);

    ExecCapture('ollama', 'pull ' + ModelId, PullOutput);

    SetProgress(BarModel, LblModelPct, 90);
    PopulateLocalModels;
    if LocalModels.IndexOf(ModelId) >= 0 then
    begin
      SetProgress(BarModel, LblModelPct, 100);
      LblModelHint.Caption := FmtMessage(CustomMessage('ModelPullDone'), [ModelId]);
      WizardForm.NextButton.Enabled := True;
    end
    else
    begin
      BarModel.Visible    := False;
      LblModelPct.Visible := False;
      LstModels.Enabled   := True;
      LblModelHint.Caption := CustomMessage('ModelPullFailed');
      WizardForm.NextButton.Enabled := True; // let the user proceed and pull later
    end;
  end;
end;

// Post-install: write config/settings.json for first-run seeding

procedure WriteFirstRunConfig;
var
  ConfigDir, ConfigFile, Json: string;
  NumOpts: Integer;
begin
  ConfigDir  := ExpandConstant('{userappdata}\Patent Workbench\config');
  ConfigFile := ConfigDir + '\settings.json';

  ForceDirectories(ConfigDir);

  NumOpts := CboNumOptions.ItemIndex + 1; // ItemIndex 0..4 → value 1..5

  Json :=
    '{' + #13#10 +
    '  "ollama_url": "' + EdtOllamaURL.Text + '",' + #13#10 +
    '  "default_model": "' + SelectedModel + '",' + #13#10 +
    '  "num_options": ' + IntToStr(NumOpts) + #13#10 +
    '}';

  SaveStringToFile(ConfigFile, Json, False);
end;

// Stores the UI language choice in a separate file read by the React app
// on first boot (localStorage seed injected via the preload in future).
// For now the setting is applied through the settings API by main.js.
procedure WriteLanguagePref;
var
  LangFile, Lang: string;
begin
  Lang     := SUPPORTED_LANGS[CboLanguage.ItemIndex];
  LangFile := ExpandConstant('{userappdata}\Patent Workbench\config\language.txt');
  SaveStringToFile(LangFile, Lang, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if SelectedModel = '' then
      SelectedModel := 'qwen2.5:7b'; // fallback default
    WriteFirstRunConfig;
    WriteLanguagePref;
  end;
end;
