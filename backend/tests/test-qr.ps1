$base = "http://localhost:5000"

$cfg = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$') { $cfg[$matches[1]] = $matches[2].Trim().Trim('"') }
}

$t = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body (@{ role="teacher"; identifier=$cfg['SEED_TEACHER_EMAIL']; password=$cfg['SEED_TEACHER_PASSWORD'] } | ConvertTo-Json)
$th = @{ Authorization = "Bearer $($t.token)" }
"Teacher: $($t.user.name)"

$s = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body (@{ role="student"; identifier=$cfg['SEED_STUDENT_REG']; password=$cfg['SEED_STUDENT_PASSWORD'] } | ConvertTo-Json)
$sh = @{ Authorization = "Bearer $($s.token)" }
"Student: $($s.user.name)"

"--- 1. student gets own QR (expect payload EDUTRACK:...)"
$me = Invoke-RestMethod -Uri "$base/api/qr/me" -Headers $sh
$me.student | ConvertTo-Json
"payload: $($me.payload)"
"image data URL starts with: $($me.qrImage.Substring(0,30))"

"--- 2. teacher identifies by QR payload (expect same student)"
Invoke-RestMethod -Method Post -Uri "$base/api/qr/identify" -Headers $th -ContentType "application/json" -Body (@{ qrPayload=$me.payload } | ConvertTo-Json) | ConvertTo-Json

"--- 3. teacher identifies by registration number (expect same student)"
Invoke-RestMethod -Method Post -Uri "$base/api/qr/identify" -Headers $th -ContentType "application/json" -Body (@{ registrationNumber=$me.student.registrationNumber } | ConvertTo-Json) | ConvertTo-Json

"--- 4. tampered QR (expect 400)"
$bad = $me.payload.Substring(0, $me.payload.Length - 1) + "z"
try { Invoke-RestMethod -Method Post -Uri "$base/api/qr/identify" -Headers $th -ContentType "application/json" -Body (@{ qrPayload=$bad } | ConvertTo-Json) } catch { "Got expected error: " + $_.ErrorDetails.Message }

"--- 5. unknown registration number (expect 404)"
try { Invoke-RestMethod -Method Post -Uri "$base/api/qr/identify" -Headers $th -ContentType "application/json" -Body (@{ registrationNumber="NOPE-0000" } | ConvertTo-Json) } catch { "Got expected error: " + $_.ErrorDetails.Message }

"--- 6. nothing provided (expect 400)"
try { Invoke-RestMethod -Method Post -Uri "$base/api/qr/identify" -Headers $th -ContentType "application/json" -Body "{}" } catch { "Got expected error: " + $_.ErrorDetails.Message }

"--- 7. teacher gets a student's QR as an image"
Invoke-WebRequest -Uri "$base/api/qr/student/$($me.student.id)?format=png" -Headers $th -OutFile qr-test.png
"Saved qr-test.png (open it to see the QR code)"

"--- 8. student cannot identify others (expect 403)"
try { Invoke-RestMethod -Method Post -Uri "$base/api/qr/identify" -Headers $sh -ContentType "application/json" -Body (@{ registrationNumber="X" } | ConvertTo-Json) } catch { "Got expected error: " + $_.ErrorDetails.Message }