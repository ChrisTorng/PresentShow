// Blank lines delimit slides; numbered lines within one slide are hanging list items.
export function readingRows(text){
  const rows=[];
  for(const line of text.split('\n')){
    const match=line.match(/^\s*(\d+[.、．)])\s*(.*)$/);
    if(match)rows.push({number:match[1],text:match[2]});
    else if(rows.length)rows.at(-1).text+='\n'+line;
    else rows.push({number:'',text:line});
  }
  return rows;
}
