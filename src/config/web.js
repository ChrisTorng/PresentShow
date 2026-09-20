export function webURL(source){
  const url=new URL(source);
  if(!['https:','http:'].includes(url.protocol))throw new Error('網頁只接受 HTTP／HTTPS 網址。');
  if(url.username||url.password)throw new Error('網頁網址不可包含帳號密碼。');
  return url;
}
export function embedURL(source){
  const url=webURL(source);
  if(url.hostname==='www.canva.com'&&/^\/design\/[^/]+\/[^/]+\/(?:edit|view)\/?$/.test(url.pathname)){
    url.pathname=url.pathname.replace(/\/(?:edit|view)\/?$/,'/view');url.search='?embed';url.hash='';
  }
  return url.href;
}
