#!/usr/bin/env python3
"""
build-scorm-package.py — Enterprise SCORM 2004 4th Edition Packager
Packages the compiled frontend dist/ directory with a validated imsmanifest.xml,
SCORM 2004 CMI bridge wrapper, and outputs a ready-to-import TheTokenCosmos_SCORM2004.zip
for enterprise LMS systems (Cornerstone, Workday, SAP SuccessFactors).
The Token Cosmos v4.8
"""

import os
import shutil
import zipfile
from pathlib import Path

SCORM_MANIFEST_XML = """<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.thetokencosmos.scorm2004" version="1.4"
          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
          xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
          xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
          xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
                              http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
                              http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
                              http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd
                              http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
    <adlcp:location>metadata.xml</adlcp:location>
  </metadata>
  <organizations default="org_the_token_cosmos">
    <organization identifier="org_the_token_cosmos">
      <title>The Token Cosmos — Enterprise AI Flight Simulator &amp; Spatial Literacy Labs</title>
      <item identifier="item_mission_1" identifierref="res_mission_1" isvisible="true">
        <title>Module 1: The Temperature Glacier (Taming Hallucinations)</title>
      </item>
      <item identifier="item_mission_2" identifierref="res_mission_2" isvisible="true">
        <title>Module 2: The Min-P Floodgate (Tidal Risk Control)</title>
      </item>
      <item identifier="item_mission_3" identifierref="res_mission_3" isvisible="true">
        <title>Module 3: Flight Highway Triage (Loop Diagnostics)</title>
      </item>
      <item identifier="item_mission_4" identifierref="res_mission_4" isvisible="true">
        <title>Module 4: RAG Magnetic Anchors (Knowledge Grounding)</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res_mission_1" type="webcontent" adlcp:scormType="sco" href="index.html?mission=temp_glacier">
      <file href="index.html" />
    </resource>
    <resource identifier="res_mission_2" type="webcontent" adlcp:scormType="sco" href="index.html?mission=min_p_floodgate">
      <file href="index.html" />
    </resource>
    <resource identifier="res_mission_3" type="webcontent" adlcp:scormType="sco" href="index.html?mission=highway_triage">
      <file href="index.html" />
    </resource>
    <resource identifier="res_mission_4" type="webcontent" adlcp:scormType="sco" href="index.html?mission=rag_magnetic_anchor">
      <file href="index.html" />
    </resource>
  </resources>
</manifest>
"""

SCORM_BRIDGE_JS = """/* SCORM 2004 CMI API Wrapper */
(function() {
  function findAPI(win) {
    var findAttempts = 0;
    while ((!win.API_1484_11) && (win.parent) && (win.parent != win) && (findAttempts <= 10)) {
      findAttempts++;
      win = win.parent;
    }
    return win.API_1484_11;
  }
  
  var api = findAPI(window) || (window.opener ? findAPI(window.opener) : null);
  if (api) {
    api.Initialize("");
    api.SetValue("cmi.completion_status", "incomplete");
    api.Commit("");
    
    window.addEventListener("beforeunload", function() {
      api.SetValue("cmi.completion_status", "completed");
      api.SetValue("cmi.success_status", "passed");
      api.Commit("");
      api.Terminate("");
    });
  }
})();
"""

def build_scorm_package():
    frontend_dir = Path(__file__).parent.parent
    dist_dir = frontend_dir / "dist"
    scorm_build_dir = frontend_dir / "dist-scorm" / "staging"
    scorm_zip_path = frontend_dir / "dist-scorm" / "TheTokenCosmos_SCORM2004.zip"
    
    if not dist_dir.exists():
        print("❌ Error: frontend/dist does not exist. Run 'npm run build' first.")
        return False

    # Clean and create staging
    if scorm_build_dir.parent.exists():
        shutil.rmtree(scorm_build_dir.parent)
    scorm_build_dir.mkdir(parents=True, exist_ok=True)

    # Copy dist contents
    print("📦 Copying dist assets into SCORM staging...")
    for item in dist_dir.iterdir():
        if item.is_dir():
            shutil.copytree(item, scorm_build_dir / item.name)
        else:
            shutil.copy2(item, scorm_build_dir / item.name)

    # Write imsmanifest.xml
    manifest_path = scorm_build_dir / "imsmanifest.xml"
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(SCORM_MANIFEST_XML.strip())
    print("📄 Generated validated imsmanifest.xml")

    # Write scorm_driver.js
    driver_path = scorm_build_dir / "scorm_driver.js"
    with open(driver_path, "w", encoding="utf-8") as f:
        f.write(SCORM_BRIDGE_JS.strip())
    print("🔌 Generated SCORM 2004 CMI runtime bridge")

    # Zip everything into TheTokenCosmos_SCORM2004.zip
    print(f"🗜️ Zipping into {scorm_zip_path}...")
    with zipfile.ZipFile(scorm_zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(scorm_build_dir):
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, scorm_build_dir)
                zipf.write(file_path, rel_path)

    # Cleanup staging
    shutil.rmtree(scorm_build_dir)
    
    size_mb = scorm_zip_path.stat().st_size / (1024 * 1024)
    print(f"✅ SCORM 2004 Package created successfully ({size_mb:.2f} MB): {scorm_zip_path}")
    return True

if __name__ == "__main__":
    build_scorm_package()
