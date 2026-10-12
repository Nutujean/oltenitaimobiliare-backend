import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createListingSeoRouter } from '../routes/listingSeoRoutes.js';
import { createSitemapRouter } from '../routes/sitemapRoutes.js';
import { isActiveListing, renderListingHtml, renderListingsSitemap } from '../utils/listingSeo.js';

const now = new Date('2026-10-12T09:00:00Z');
const id = '6ac9dee248a854d06b111c92';
const listing = {_id:id,title:'Casă în Oltenița',description:'Descriere completă\nCurte și grădină.',location:'Oltenița',category:'case',price:139998,images:['https://example.com/house.jpg'],visibility:'public',status:'disponibil',expiresAt:'2099-10-24',createdAt:'2026-10-10',updatedAt:'2026-10-11',phone:'0700000000',userEmail:'private@example.invalid'};
const shell = '<!doctype html><html lang="ro" data-seo-shell="true"><head><title>Homepage</title><meta data-rh="true" name="robots" content="noindex"><link data-rh="true" rel="canonical" href="https://oltenitaimobiliare.ro/"><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>';

test('real listing content replaces the shell metadata, while the application assets remain', () => {
 const html=renderListingHtml(listing,shell,now);
 assert.match(html,/<h1>Casă în Oltenița<\/h1>/);
 assert.match(html,/139\.998 €/);
 assert.match(html,/Curte și grădină/);
 assert.match(html,/<img src="https:\/\/example.com\/house.jpg"/);
 assert.match(html,/href="https:\/\/oltenitaimobiliare.ro\/anunt\/6ac9dee248a854d06b111c92"/);
 assert.match(html,/name="robots" content="index, follow"/);
 assert.match(html,/src="\/assets\/app.js"/);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
 assert.equal((html.match(/<title>/g)||[]).length,1);
 assert.ok(!html.includes('Homepage'));
 assert.ok(!html.includes('private@example.invalid'));
 const schema=JSON.parse(html.match(/data-listing-seo>(.*?)<\/script>/s)[1]);
 assert.equal(schema['@type'],'RealEstateListing');
 assert.equal(schema.url,'https://oltenitaimobiliare.ro/anunt/'+id);
});

test('user content is escaped in HTML and JSON, unsafe image schemes are excluded', () => {
 const html=renderListingHtml({...listing,title:'<script>alert(1)</script>',description:'</script><img src=x onerror=alert(1)>',images:['javascript:alert(1)','https://example.com/pic.jpg?x="oops"']},shell,now);
 assert.ok(!html.includes('<script>alert(1)</script>'));
 assert.ok(!html.includes('<img src=x onerror'));
 assert.ok(!html.includes('src="javascript:'));
 assert.match(html,/&lt;script&gt;/);
 JSON.parse(html.match(/data-listing-seo>(.*?)<\/script>/s)[1]);
});

test('expired, sold and private listings are not active; reserved listings stay public', () => {
 for(const changes of [{status:'expirat'},{expiresAt:'2026-10-11'},{vandut:true},{visibility:'draft'}]) assert.equal(isActiveListing({...listing,...changes},now),false);
 assert.equal(isActiveListing({...listing,rezervat:true},now),true);
 assert.equal(isActiveListing({...listing,visibility:undefined,expiresAt:undefined},now),true);
});

test('expired content is labelled and noindexed; fallback HTML remains usable without the shell', () => {
 const html=renderListingHtml({...listing,expiresAt:'2026-10-11'},null,now);
 assert.match(html,/noindex, follow/);
 assert.match(html,/Anunț expirat/);
 assert.match(html,/Descriere completă/);
 assert.ok(!html.includes('href="tel:'));
});

test('sitemap contains only public active offers and valid database modification dates', () => {
 const records=[listing,{...listing,_id:'draft',visibility:'draft'},{...listing,_id:'sold',vandut:true},{...listing,_id:'expired',expiresAt:'2026-10-11'},{...listing,_id:'status-expired',status:'expirat'},{...listing,_id:'legacy',visibility:undefined,expiresAt:undefined,updatedAt:undefined,createdAt:undefined}];
 const xml=renderListingsSitemap(records,now);
 assert.equal((xml.match(/<url>/g)||[]).length,2);
 assert.match(xml,new RegExp('/anunt/'+id));
 for(const excluded of ['draft','sold','expired','status-expired']) assert.ok(!xml.includes('/anunt/'+excluded));
 assert.match(xml,/<lastmod>2026-10-11T00:00:00.000Z<\/lastmod>/);
 assert.ok(!xml.includes('Invalid Date'));
 assert.equal(renderListingsSitemap([],now).includes('<url>'),false);
});

async function withServer(model, callback, getTemplate=async()=>shell) {
 const app=express();app.use(createListingSeoRouter({ListingModel:model,getTemplate}));app.use(createSitemapRouter({ListingModel:model}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try {await callback(`http://127.0.0.1:${server.address().port}`);} finally {await new Promise(r=>server.close(r));}
}
const query=value=>({select(){return this},sort(){return this},lean(){return this},exec:async()=>value});

test('HTTP route gives current property HTML to browsers and crawlers alike', async () => {
 await withServer({findById:()=>query(listing)},async base=>{
  for(const ua of ['Mozilla/5.0','Googlebot','OAI-SearchBot']){
   const response=await fetch(base+'/seo/anunt/'+id,{headers:{'User-Agent':ua}});
   assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
   assert.match(await response.text(),/<h1>Casă în Oltenița<\/h1>/);
  }
 });
});

test('missing, malformed and draft URLs return a real 404 without private content', async () => {
 await withServer({findById:which=>query(which===id?{...listing,visibility:'draft'}:null)},async base=>{
  for(const which of [id,'000000000000000000000000','invalid-id']){
   const response=await fetch(base+'/seo/anunt/'+which);assert.equal(response.status,404);
   assert.match(response.headers.get('x-robots-tag'),/noindex/);
   const html=await response.text();assert.ok(!html.includes(listing.title));assert.ok(!html.includes(listing.phone));
  }
 });
});

test('HTTP sitemap remains dynamic and does not leak inactive or draft offers', async () => {
 let call=0;
 await withServer({find:()=>query(call++===0?[listing,{...listing,_id:'draft',visibility:'draft'}]:[])},async base=>{
  const first=await fetch(base+'/sitemap-listings.xml');assert.equal(first.status,200);
  assert.match(first.headers.get('content-type'),/application\/xml/);
  assert.equal(first.headers.get('cache-control'),'no-store');
  const firstXml=await first.text();assert.match(firstXml,new RegExp('/anunt/'+id));assert.ok(!firstXml.includes('/anunt/draft'));
  const second=await fetch(base+'/sitemap.xml');assert.ok(!(await second.text()).includes('/anunt/'+id));
 });
});

test('database failures return temporary 503 responses instead of fake successful pages', async () => {
 const failing=()=>({select(){return this},sort(){return this},lean(){return this},exec:async()=>{throw Error('test database outage')}});
 await withServer({findById:failing,find:failing},async base=>{
  for(const path of ['/seo/anunt/'+id,'/sitemap-listings.xml']){
   const response=await fetch(base+path);assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),'60');
  }
 });
});

test('server HTML reuses the detail image derivative and never stacks Cloudinary transforms', () => {
 const raw='https://res.cloudinary.com/demo/image/upload/v123/house.jpg';
 const optimized='https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good,c_limit,w_1600,h_1000/v123/house.jpg';
 for(const image of [raw,optimized]){
  const html=renderListingHtml({...listing,images:[image]},shell,now);
  assert.match(html,new RegExp(optimized.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.ok(!html.includes('w_1600,h_1000/f_auto'));
 }
});
