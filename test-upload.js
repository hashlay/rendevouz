import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function test() {
  const form = new FormData();
  form.append('title', 'test');
  form.append('event', 'test event');
  form.append('performer', 'test performer');
  form.append('stageName', 'stage 1');
  
  fs.writeFileSync('dummy.mp4', Buffer.alloc(1024));
  form.append('video', fs.createReadStream('dummy.mp4'));

  try {
    const loginForm = { username: 'superadmin', password: 'password123' };
    const loginRes = await fetch('http://localhost:3001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm)
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    const res = await fetch('http://localhost:3001/api/highlights/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });
    
    console.log(res.status, await res.text());
  } catch (err) {
    console.error(err);
  }
}
test();
