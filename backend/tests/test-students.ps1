$base = "http://localhost:5000"

# Read demo teacher login from .env (stays on your computer, never printed)
$cfg = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$') { $cfg[$matches[1]] = $matches[2].Trim().Trim('"') }
}
$email = $cfg['SEED_TEACHER_EMAIL']
$plain = $cfg['SEED_TEACHER_PASSWORD']
if (-not $email -or -not $plain) { "SEED_TEACHER_EMAIL or SEED_TEACHER_PASSWORD missing in .env"; exit }

$login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body (@{ role="teacher"; identifier=$email; password=$plain } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.token)" }
"Logged in as: $($login.user.name)"

$stamp = Get-Date -Format "HHmmss"

"--- 1. register student (expect 201, reg number + temporaryPassword)"
$new = Invoke-RestMethod -Method Post -Uri "$base/api/students" -Headers $h -ContentType "application/json" -Body (@{ name="Test Student $stamp"; email="test$stamp@example.com"; dateOfBirth="2010-05-14"; phone="+94771234567" } | ConvertTo-Json)
$new | ConvertTo-Json -Depth 5

"--- 2. same email again (expect 409)"
try { Invoke-RestMethod -Method Post -Uri "$base/api/students" -Headers $h -ContentType "application/json" -Body (@{ name="Dup"; email="test$stamp@example.com" } | ConvertTo-Json) } catch { "Got expected error: " + $_.ErrorDetails.Message }

"--- 3. invalid input (expect 400)"
try { Invoke-RestMethod -Method Post -Uri "$base/api/students" -Headers $h -ContentType "application/json" -Body (@{ name=""; phone="abc" } | ConvertTo-Json) } catch { "Got expected error: " + $_.ErrorDetails.Message }

"--- 4. list students"
Invoke-RestMethod -Uri "$base/api/students" -Headers $h | ConvertTo-Json -Depth 5

"--- 5. get one student"
Invoke-RestMethod -Uri "$base/api/students/$($new.student.id)" -Headers $h | ConvertTo-Json -Depth 5

"--- 6. new student can log in"
$s = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body (@{ role="student"; identifier=$new.student.registrationNumber; password=$new.temporaryPassword } | ConvertTo-Json)
"Student login OK: $($s.user.name)"

"--- 7. student cannot register students (expect 403)"
$sh = @{ Authorization = "Bearer $($s.token)" }
try { Invoke-RestMethod -Method Post -Uri "$base/api/students" -Headers $sh -ContentType "application/json" -Body (@{ name="x" } | ConvertTo-Json) } catch { "Got expected error: " + $_.ErrorDetails.Message }