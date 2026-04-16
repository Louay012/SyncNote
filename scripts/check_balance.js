const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'front', 'components', 'diary', 'DiaryLayout.jsx');
console.log('checking', file);
const s = fs.readFileSync(file, 'utf8');
let stacks = {"()":0,"[]":0,"{}":0};
let quotes = {single:false,double:false,back:false,esc:false};
for(let i=0;i<s.length;i++){
  let c=s[i];
  if(quotes.esc){quotes.esc=false;continue;}
  if(c==='\\'){quotes.esc=true;continue;}
  if(!quotes.single && !quotes.back && c==='"') quotes.double=!quotes.double;
  else if(!quotes.double && !quotes.back && c==="'") quotes.single=!quotes.single;
  else if(!quotes.single && !quotes.double && c==='`') quotes.back=!quotes.back;
  if(quotes.single||quotes.double||quotes.back) continue;
  if(c==='(') stacks['()']++;
  else if(c===')') stacks['()']--;
  else if(c==='[') stacks['[]']++;
  else if(c===']') stacks['[]']--;
  else if(c==='{') stacks['{}']++;
  else if(c==='}') stacks['{}']--;
  if(stacks['()']<0||stacks['[]']<0||stacks['{}']<0) {
    console.log(JSON.stringify({ok:false,i:i,char:c,stacks},null,2));
    process.exit(0);
  }
}
console.log(JSON.stringify({ok:stacks['()']===0&&stacks['[]']===0&&stacks['{}']===0,stacks},null,2));
