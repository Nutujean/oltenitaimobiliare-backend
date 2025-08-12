import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import Stripe from 'stripe';

dotenv.config();
const app = express();

// --- Config ---
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/oltenitaimobiliare';
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const RESERVATION_AMOUNT_RON = Number(process.env.RESERVATION_AMOUNT_RON || 100);
const STRIPE_SECRET = process.env.STRIPE_SECRET || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null;

// --- DB & Models ---
mongoose.connect(MONGO_URI).then(()=>console.log('Mongo connected')).catch(err=>console.error('Mongo error', err));

const userSchema = new mongoose.Schema({
  name: { type:String, required:true },
  email: { type:String, required:true, unique:true },
  passwordHash: { type:String, required:true }
},{timestamps:true});

const listingSchema = new mongoose.Schema({
  title:{ type:String, required:true },
  category:{ type:String, enum:['apartamente','garsoniere','case','terenuri','inchirieri'], required:true },
  price:{ type:Number, required:true }, // tratăm ca RON pt plăți
  area:Number, address:String, description:String, imageUrl:String, phone:String, whatsapp:String,
  isPaid:{ type:Boolean, default:false }, paidAt:Date, paymentId:String, buyerEmail:String,
  paymentType:{ type:String, enum:['reservation','full', null], default:null },
  amountPaid:Number, currency:String,
  owner:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true }
},{timestamps:true});

const User = mongoose.model('User', userSchema);
const Listing = mongoose.model('Listing', listingSchema);

// --- Webhook Stripe (raw body) ---
if (STRIPE_WEBHOOK_SECRET && stripe) {
  app.post('/api/pay/webhook', express.raw({ type:'application/json' }), async (req,res)=>{
    try{
      const sig = req.headers['stripe-signature'];
      const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      if(event.type==='checkout.session.completed'){
        const s = event.data.object;
        const listingId = s.metadata?.listingId;
        if(listingId){
          await Listing.findByIdAndUpdate(listingId, {
            isPaid:true, paidAt:new Date(), paymentId:s.id,
            buyerEmail: s.customer_details?.email || s.customer_email || null,
            paymentType: s.metadata?.type || null,
            amountPaid: typeof s.amount_total==='number' ? s.amount_total/100 : undefined,
            currency: s.currency
          });
        }
      }
      res.json({received:true});
    }catch(e){ console.error('Webhook error', e.message); res.status(400).send(`Webhook Error: ${e.message}`); }
  });
}

// --- Normal body parsers (după webhook) ---
app.use(cors({ origin: CLIENT_ORIGIN, credentials:true }));
app.use(morgan('dev'));
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true }));

// --- Helpers ---
const signToken = (u)=> jwt.sign({ id:u._id, email:u.email, name:u.name }, JWT_SECRET, { expiresIn:'7d' });
const auth = (req,res,next)=>{
  const h=req.headers.authorization||''; const t=h.startsWith('Bearer ')?h.slice(7):null;
  if(!t) return res.status(401).json({error:'Fără token'});
  try{ req.user = jwt.verify(t, JWT_SECRET); next(); }catch{ return res.status(401).json({error:'Token invalid'}) }
};

// --- Routes ---
app.get('/', (req,res)=> res.json({ ok:true, name:'OltenitaImobiliare API', payments:Boolean(stripe) }));

// Auth
app.post('/api/auth/register', async (req,res)=>{
  try{
    const {name,email,password}=req.body;
    if(!name||!email||!password) return res.status(400).json({error:'Date incomplete'});
    if(await User.findOne({email})) return res.status(400).json({error:'Email deja folosit'});
    const passwordHash = await bcrypt.hash(password,10);
    const user = await User.create({name,email,passwordHash});
    res.json({ token:signToken(user), user:{id:user._id,name:user.name,email:user.email} });
  }catch(e){ console.error(e); res.status(500).json({error:'Eroare server'}); }
});
app.post('/api/auth/login', async (req,res)=>{
  try{
    const {email,password}=req.body; const u=await User.findOne({email});
    if(!u || !(await bcrypt.compare(password,u.passwordHash))) return res.status(400).json({error:'Email sau parolă greșite'});
    res.json({ token:signToken(u), user:{id:u._id,name:u.name,email:u.email} });
  }catch(e){ res.status(500).json({error:'Eroare server'}); }
});

// Listings
app.get('/api/listings', async (req,res)=>{
  const {q,category,minPrice,maxPrice,sort}=req.query; const w={};
  if(q) w.$or=[{title:new RegExp(q,'i')},{description:new RegExp(q,'i')},{address:new RegExp(q,'i')}];
  if(category) w.category=category;
  if(minPrice) w.price={...(w.price||{}), $gte:Number(minPrice)};
  if(maxPrice) w.price={...(w.price||{}), $lte:Number(maxPrice)};
  let qu = Listing.find(w).populate('owner','name email');
  if(sort==='priceAsc') qu=qu.sort({price:1}); else if(sort==='priceDesc') qu=qu.sort({price:-1}); else qu=qu.sort({createdAt:-1});
  res.json(await qu.exec());
});
app.get('/api/listings/:id', async (req,res)=>{
  const it=await Listing.findById(req.params.id).populate('owner','name email'); if(!it) return res.status(404).json({error:'Anunț inexistent'}); res.json(it);
});
app.post('/api/listings', auth, async (req,res)=>{
  try{
    const { title, category, price, area, address, description, imageUrl, phone, whatsapp } = req.body;
    if(!title||!category||!price) return res.status(400).json({error:'Titlu, categorie și preț obligatorii'});
    const it = await Listing.create({ title, category, price, area, address, description, imageUrl, phone, whatsapp, owner:req.user.id });
    res.status(201).json(it);
  }catch(e){ console.error(e); res.status(500).json({error:'Eroare creare'}); }
});
app.patch('/api/listings/:id', auth, async (req,res)=>{
  const it=await Listing.findById(req.params.id); if(!it) return res.status(404).json({error:'Anunț inexistent'});
  if(it.owner.toString()!==req.user.id) return res.status(403).json({error:'Nu ai drepturi'});
  Object.assign(it, req.body); await it.save(); res.json(it);
});
app.delete('/api/listings/:id', auth, async (req,res)=>{
  const it=await Listing.findById(req.params.id); if(!it) return res.status(404).json({error:'Anunț inexistent'});
  if(it.owner.toString()!==req.user.id) return res.status(403).json({error:'Nu ai drepturi'});
  await it.deleteOne(); res.json({ok:true});
});

// Upload imagine (Cloudinary opțional)
const upload = multer({ storage: multer.memoryStorage(), limits:{fileSize:5*1024*1024} });
app.post('/api/upload', auth, upload.single('image'), async (req,res)=>{
  try{
    if(!process.env.CLOUDINARY_CLOUD_NAME) return res.status(400).json({error:'Cloudinary nu e configurat'});
    const file = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const up = await cloudinary.uploader.upload(file, { folder:'oltenitaimobiliare' });
    res.json({ url: up.secure_url });
  }catch(e){ console.error(e); res.status(500).json({error:'Upload eșuat'}); }
});

// Plăți Stripe
app.post('/api/pay/reservation', auth, async (req,res)=>{
  try{
    if(!stripe) return res.status(400).json({error:'Stripe nu este configurat'});
    const { listingId } = req.body;
    const it = await Listing.findById(listingId); if(!it) return res.status(404).json({error:'Anunț inexistent'});
    if(it.isPaid) return res.status(400).json({error:'Anunț deja plătit'});
    const amount = Math.max(200, Math.round(RESERVATION_AMOUNT_RON*100)); // minim 2 RON
    const s = await stripe.checkout.sessions.create({
      mode:'payment', payment_method_types:['card'], currency:'ron',
      line_items:[{ quantity:1, price_data:{ currency:'ron', unit_amount:amount, product_data:{ name:`Taxă rezervare: ${it.title}`, description: it.address? `Oltenița – ${it.address}` : 'Oltenița' } } }],
      metadata:{ listingId: it._id.toString(), type:'reservation' },
      success_url: `${CLIENT_ORIGIN}/plata-succes?session_id={CHECKOUT_SESSION_ID}&listing=${it._id}`,
      cancel_url: `${CLIENT_ORIGIN}/plata-anulata?listing=${it._id}`
    });
    res.json({ url: s.url });
  }catch(e){ console.error('pay/reservation',e); res.status(500).json({error:'Nu am putut crea sesiunea de plată'}); }
});

app.post('/api/pay/full/:id', auth, async (req,res)=>{
  try{
    if(!stripe) return res.status(400).json({error:'Stripe nu este configurat'});
    const it = await Listing.findById(req.params.id); if(!it) return res.status(404).json({error:'Anunț inexistent'});
    if(it.isPaid) return res.status(400).json({error:'Anunț deja plătit'});
    const amount = Math.max(200, Math.round((it.price||0)*100));
    const s = await stripe.checkout.sessions.create({
      mode:'payment', payment_method_types:['card'], currency:'ron',
      line_items:[{ quantity:1, price_data:{ currency:'ron', unit_amount:amount, product_data:{ name:`Plată integrală: ${it.title}`, description: it.address? `Oltenița – ${it.address}` : 'Oltenița' } } }],
      metadata:{ listingId: it._id.toString(), type:'full' },
      success_url: `${CLIENT_ORIGIN}/plata-succes?session_id={CHECKOUT_SESSION_ID}&listing=${it._id}`,
      cancel_url: `${CLIENT_ORIGIN}/plata-anulata?listing=${it._id}`
    });
    res.json({ url: s.url });
  }catch(e){ console.error('pay/full',e); res.status(500).json({error:'Nu am putut crea sesiunea de plată'}); }
});

app.listen(PORT, ()=> console.log('API on', PORT));
