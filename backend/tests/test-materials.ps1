$base = "http://localhost:5000"

$cfg = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$') { $cfg[$matches[1]] = $matches[2].Trim().Trim('"') }
}

$t = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body (@{ role="teacher"; identifier=$cfg['SEED_TEACHER_EMAIL']; password=$cfg['SEED_TEACHER_PASSWORD'] } | ConvertTo-Json)
$s = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body (@{ role="student"; identifier=$cfg['SEED_STUDENT_REG']; password=$cfg['SEED_STUDENT_PASSWORD'] } | ConvertTo-Json)
$th = @{ Authorization = "Bearer $($t.token)" }
$tAuth = "Authorization: Bearer $($t.token)"
$sAuth = "Authorization: Bearer $($s.token)"
"Teacher: $($t.user.name) | Student: $($s.user.name)"

Set-Content -Path test-upload.pdf -Value "%PDF-1.4 EduTrack test material"
Set-Content -Path test-upload.exe -Value "not allowed"

$cls = Invoke-RestMethod -Method Post -Uri "$base/api/classes" -Headers $th -ContentType "application/json" -Body (@{ name="Material Test"; subject="Science"; fee=1000 } | ConvertTo-Json)
$cid = $cls.class.id
Invoke-RestMethod -Method Post -Uri "$base/api/classes/$cid/students" -Headers $th -ContentType "application/json" -Body (@{ registrationNumber=$cfg['SEED_STUDENT_REG'].ToUpper() } | ConvertTo-Json) | Out-Null

$other = Invoke-RestMethod -Method Post -Uri "$base/api/classes" -Headers $th -ContentType "application/json" -Body (@{ name="Other Class"; subject="Art"; fee=500 } | ConvertTo-Json)
$oid = $other.class.id

"--- 1. teacher uploads PDF (expect 201)"
$up = curl.exe -s -X POST "$base/api/materials" -H $tAuth -F "classId=$cid" -F "title=Chapter 1 Notes" -F "file=@test-upload.pdf;type=application/pdf" | ConvertFrom-Json
$up | ConvertTo-Json -Depth 5
$mid = $up.material.id

"--- 2. wrong file type .exe (expect 400)"
curl.exe -s -X POST "$base/api/materials" -H $tAuth -F "classId=$cid" -F "title=Bad" -F "file=@test-upload.exe;type=application/x-msdownload"
""

"--- 3. missing title (expect 400)"
curl.exe -s -X POST "$base/api/materials" -H $tAuth -F "classId=$cid" -F "file=@test-upload.pdf;type=application/pdf"
""

"--- 4. student cannot upload (expect 403)"
curl.exe -s -X POST "$base/api/materials" -H $sAuth -F "classId=$cid" -F "title=x" -F "file=@test-upload.pdf;type=application/pdf"
""

"--- 5. enrolled student lists materials (expect 1)"
(Invoke-RestMethod -Uri "$base/api/materials?classId=$cid" -Headers @{ Authorization = "Bearer $($s.token)" }).count

"--- 6. student downloads the file (expect the PDF text)"
curl.exe -s -H $sAuth "$base/api/materials/$mid/download"

"--- 7. student lists a class they are not in (expect 403)"
curl.exe -s -H $sAuth "$base/api/materials?classId=$oid"
""

"--- 8. student cannot delete (expect 403)"
curl.exe -s -X DELETE -H $sAuth "$base/api/materials/$mid"
""

"--- 9. teacher deletes (expect Material deleted)"
curl.exe -s -X DELETE -H $tAuth "$base/api/materials/$mid"
""

"--- 10. download after delete (expect 404)"
curl.exe -s -H $tAuth "$base/api/materials/$mid/download"
""

Invoke-RestMethod -Method Delete -Uri "$base/api/classes/$cid" -Headers $th | Out-Null
Invoke-RestMethod -Method Delete -Uri "$base/api/classes/$oid" -Headers $th | Out-Null
Remove-Item test-upload.pdf, test-upload.exe -ErrorAction SilentlyContinue
"Done."