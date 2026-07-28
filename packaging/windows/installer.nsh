; Дополнительная страница установщика: пользователь сам выбирает, какие
; ярлыки создавать. Штатный NSIS от electron-builder такой страницы не даёт —
; он либо всегда делает ярлыки, либо никогда.
;
; Хуки electron-builder (templates/nsis/assistedInstaller.nsh):
;   customPageAfterChangeDir — вставляется ТАМ, ГДЕ ОБЪЯВЛЯЮТСЯ СТРАНИЦЫ,
;                              то есть внутрь него годится только «Page custom»,
;                              а сам диалог обязан жить в Function;
;   customInstall            — код в конце установки;
;   customUnInstall          — код при удалении.
;
; ВАЖНО-1: скрипт компилируется ДВАЖДЫ — для установщика и для деинсталлятора
; (второй раз с BUILD_UNINSTALLER). Во второй проход страницы не вставляются,
; и объявленные снаружи переменные оказались бы «нигде не используются» —
; NSIS выдаёт warning, а electron-builder считает warning ошибкой сборки.
; Поэтому всё, что нужно только установщику, объявляем под !ifndef.
;
; ВАЖНО-2: этот файл подключается ДО MUI2.nsh, поэтому макроса MUI_HEADER_TEXT
; здесь ещё нет. Заголовок страницы ставим руками: 1037 — крупная строка,
; 1038 — пояснение под ней (это стандартные ID шапки MUI).
;
; Все заголовки заранее подключаемых файлов имеют защиту от повторного
; включения, так что !include ниже безопасен.

!include LogicLib.nsh
!include WinMessages.nsh
!include nsDialogs.nsh

!ifndef BUILD_UNINSTALLER
  ; Первая страница — не «лицензия», а предупреждение об авторстве, поэтому
  ; перебиваем стандартные надписи MUI. Работает потому, что этот файл
  ; подключается ДО вставки самой страницы (!insertmacro MUI_PAGE_LICENSE).
  !define MUI_PAGE_HEADER_TEXT "Must read"
  !define MUI_PAGE_HEADER_SUBTEXT "How Phy.Sim was made."
  !define MUI_LICENSEPAGE_TEXT_TOP "Press Page Down to read the whole notice."
  !define MUI_LICENSEPAGE_TEXT_BOTTOM "Click I Agree to accept this notice and the GPL-3.0 license and continue."
  !define MUI_LICENSEPAGE_BUTTON "I Agree"

  Var PhyDesktopCB
  Var PhyMenuCB
  Var PhyWantDesktop
  Var PhyWantMenu

  !macro customPageAfterChangeDir
    Page custom PhyShortcutsPageShow PhyShortcutsPageLeave
  !macroend

  Function PhyShortcutsPageShow
    GetDlgItem $0 $HWNDPARENT 1037
    SendMessage $0 ${WM_SETTEXT} 0 "STR:Shortcuts"
    GetDlgItem $0 $HWNDPARENT 1038
    SendMessage $0 ${WM_SETTEXT} 0 "STR:Choose where to put Phy.Sim."

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ; Высота метки — с запасом: пустая строка съедает целую строку, и при 28u
    ; последняя строка обрезалась по горизонтали.
    ${NSD_CreateLabel} 0 0 100% 40u "Phy.Sim will be installed into the folder you picked.$\r$\n$\r$\nTick the shortcuts you want — the program can always be started from that folder anyway."
    Pop $1

    ${NSD_CreateCheckbox} 0 46u 100% 12u "Create a shortcut on the Desktop"
    Pop $PhyDesktopCB
    ${NSD_SetState} $PhyDesktopCB ${BST_CHECKED}

    ${NSD_CreateCheckbox} 0 62u 100% 12u "Add Phy.Sim to the Start menu"
    Pop $PhyMenuCB
    ${NSD_SetState} $PhyMenuCB ${BST_CHECKED}

    nsDialogs::Show
  FunctionEnd

  ; Состояние галочек читаем ЗДЕСЬ: после закрытия страницы её элементы
  ; уничтожаются, и в customInstall спрашивать было бы уже некого.
  Function PhyShortcutsPageLeave
    ${NSD_GetState} $PhyDesktopCB $PhyWantDesktop
    ${NSD_GetState} $PhyMenuCB $PhyWantMenu
  FunctionEnd

  !macro customInstall
    ${If} $PhyWantDesktop == ${BST_CHECKED}
      CreateShortCut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    ${EndIf}
    ${If} $PhyWantMenu == ${BST_CHECKED}
      CreateShortCut "$SMPROGRAMS\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    ${EndIf}
  !macroend
!endif

; Удаляем оба ярлыка независимо от того, какие ставили: Delete по
; несуществующему файлу молча ничего не делает.
!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_FILENAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_FILENAME}.lnk"
!macroend
