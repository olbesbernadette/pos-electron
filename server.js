const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

/**
 * ESCAPE TEXT SAFELY FOR POWERSHELL
 */
function escapePowerShell(text) {
  return text
    .replace(/`/g, "``")
    .replace(/"/g, '`"')
    .replace(/\$/g, "`$")
    .replace(/\n/g, "`n");
}

/**
 * PRINT ENDPOINT
 */
app.post("/print", (req, res) => {
  try {
    let { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    // Build ESC/POS commands for 80mm thermal printer
    let escpos = "";

    // Reset printer
    escpos += "\x1B\x40";

    // Set left margin to 0
    escpos += "\x1B\x6C\x00";

    // Set print area width for 80mm (no left/right margins)
    escpos += "\x1D\x57\xFF\x00"; // Max width

    // Left alignment (default)
    escpos += "\x1B\x61\x00";

    // Add the text
    escpos += text;

    // Add line breaks
    escpos += "\n\n\n";

    // Escape special characters for PowerShell
    const escapedContent = escapePowerShell(escpos);

    /**
     * SEND RAW ESC/POS COMMANDS TO PRINTER
     */
    const command = `powershell -Command "[System.IO.File]::WriteAllBytes([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::System) + '\\\\printers\\\\' + (Get-Printer | Where-Object {$_.PrinterStatus -eq 'Normal'} | Select-Object -First 1).Name, [System.Text.Encoding]::UTF8.GetBytes(\\\"${escapedContent}\\\"))"`;

    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (err) => {
      if (err) {
        console.error("PRINT ERROR:", err);
        return res.status(500).json({ success: false, error: err.message });
      }
    });

    return res.json({
      success: true,
      message: "Receipt sent to printer (80mm, no margins)"
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * HEALTH CHECK
 */
app.get("/", (req, res) => {
  res.send("🖨️ Silent POS Print Server Running");
});

/**
 * START SERVER
 */
app.listen(3001, () => {
  console.log("🖨️ Print server running on http://localhost:3001");
});
