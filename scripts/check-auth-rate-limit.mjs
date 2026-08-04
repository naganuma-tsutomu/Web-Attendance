const targetUrl = process.env.RATE_LIMIT_TARGET_URL?.replace(/\/$/, '');
const maxAttempts = Number(process.env.RATE_LIMIT_CHECK_ATTEMPTS ?? 20);

if (!targetUrl) {
  console.error('RATE_LIMIT_TARGET_URL を指定してください（例: https://preview.example.com）');
  process.exit(2);
}
if (!Number.isInteger(maxAttempts) || maxAttempts < 2 || maxAttempts > 100) {
  console.error('RATE_LIMIT_CHECK_ATTEMPTS は2〜100の整数で指定してください');
  process.exit(2);
}

const checks = [
  {
    label: 'スタッフログイン',
    path: '/api/auth/staff-login',
    body: { name: '__rate_limit_smoke_test__', accessKey: '000000' },
  },
  {
    label: '管理者ログイン',
    path: '/api/auth/login',
    body: { password: '__rate_limit_smoke_test__' },
  },
];

let failed = false;
for (const check of checks) {
  let limitedAt = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${targetUrl}${check.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(check.body),
      redirect: 'manual',
    });
    if (response.status === 429) {
      limitedAt = attempt;
      break;
    }
  }

  if (limitedAt === null) {
    console.error(`NG: ${check.label}は${maxAttempts}回以内に429を返しませんでした`);
    failed = true;
  } else {
    console.log(`OK: ${check.label}は${limitedAt}回目に429を返しました`);
  }
}

if (failed) process.exit(1);
