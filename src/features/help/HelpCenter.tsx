import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, PlayCircle, Search, X } from 'lucide-react'
import type { Employee } from '../employees/model'
import type { PermissionState } from '../roles-permissions/model'
import type { AppRoute } from '../../shell/navigation'
import { articleById, searchArticles, suggestedArticles, visibleArticles } from './articles'
import './help-center.css'

const articleFromHash=():string|null=>{
  const found=/^#\/?help\/article\/([a-z0-9-]+)$/.exec(location.hash)
  return found?.[1]??null
}
export function HelpCenter({employee,permissions,context,focusSearch,focusTutorialStart,onCreateSupportTicket,onStartTutorial}:{
  employee:Employee;permissions:PermissionState;context:AppRoute;focusSearch:boolean
  focusTutorialStart?:boolean;onCreateSupportTicket:(articleId:string)=>void;onStartTutorial:()=>void
}) {
  const [selected,setSelected]=useState(articleFromHash)
  const [query,setQuery]=useState('')
  const input=useRef<HTMLInputElement>(null)
  const tutorialStart=useRef<HTMLButtonElement>(null)
  const authorized=useMemo(()=>visibleArticles(employee,permissions),[employee,permissions])
  const matching=useMemo(()=>searchArticles(authorized,query),[authorized,query])
  const suggestions=useMemo(()=>suggestedArticles(authorized,context),[authorized,context])
  const article=selected?articleById(employee,permissions,selected):undefined
  const restricted=selected&&!article
  useEffect(()=>{
    const onHash=()=>setSelected(articleFromHash())
    window.addEventListener('hashchange',onHash)
    return ()=>window.removeEventListener('hashchange',onHash)
  },[])
  useEffect(()=>{if(focusSearch&&!selected)input.current?.focus()},[focusSearch,selected])
  useEffect(()=>{if(focusTutorialStart&&!selected)tutorialStart.current?.focus()},[focusTutorialStart,selected])
  const openArticle=(id:string)=>{if(!authorized.some(entry=>entry.id===id))return;location.hash=`#/help/article/${id}`;setSelected(id)}
  const browse=()=>{location.hash='#/help';setSelected(null)}
  const canCreate=employee.active && (employee.role==='restaurant'||employee.role==='front-desk')
  return <section className="hc-page" aria-label="Help Center">
    {article ? <>
      <button type="button" className="hc-back" onClick={browse}><ArrowLeft size={17}/> All articles</button>
      <div className="hc-reader rt-enter-content"><span className="hc-category">{article.category}</span>
        <h1>{article.title}</h1><p className="hc-lead">{article.summary}</p>
        <ol className="hc-steps">{article.steps.map((step,index)=><li key={index}><span>{index+1}</span><p>{step}</p></li>)}</ol>
        {article.note&&<p className="hc-note">{article.note}</p>}
        {!!article.related?.some(id=>authorized.some(entry=>entry.id===id))&&<div className="hc-related"><h2>Related articles</h2>
          {article.related.filter(id=>authorized.some(entry=>entry.id===id)).map(id=>{
            const item=authorized.find(entry=>entry.id===id)!
            return <button type="button" key={id} onClick={()=>openArticle(id)}>{item.title}<ArrowRight size={15}/></button>
          })}</div>}
        {canCreate&&<div className="hc-assistance"><h2>Still need help?</h2><p>Report the issue to Administration</p>
          <button type="button" className="rt-btn rt-btn-primary" onClick={()=>onCreateSupportTicket(article.id)}>Create Support Ticket</button></div>}
      </div>
    </> : restricted ? <div className="hc-restricted" role="alert"><h1>Article unavailable</h1>
      <p>This article is not available to your account</p><button type="button" className="rt-btn" onClick={browse}>Back to Help Center</button></div> : <>
      <h1>Help Center</h1>
      <button ref={tutorialStart} type="button" className="hc-tutorial-entry" onClick={onStartTutorial}>
        <span className="hc-tutorial-icon"><PlayCircle size={23} aria-hidden="true"/></span>
        <span><strong>Start Tutorial</strong><small>Watch a guided introduction for your employee role</small></span>
        <ArrowRight size={19} aria-hidden="true"/>
      </button>
      <label className="hc-search"><Search size={21} aria-hidden="true"/><span className="rt-sr-only">Search Help articles</span>
        <input ref={input} type="search" placeholder="Search for answers" value={query} onChange={e=>setQuery(e.target.value)}/>
        {query&&<button type="button" aria-label="Clear Help search" onClick={()=>{setQuery('');input.current?.focus()}}><X size={17}/></button>}</label>
      {!query&&suggestions.length>0&&<div className="hc-group rt-enter-content"><h2>Suggested</h2><div className="hc-article-list">
        {suggestions.map(item=><button type="button" className="hc-article" key={item.id} onClick={()=>openArticle(item.id)}>
          <BookOpen size={18} aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.summary}</small></span><ArrowRight size={16}/></button>)}
      </div></div>}
      <div className="hc-group rt-enter-content"><h2>{query?'Search results':'All articles'}</h2>
        <div className="hc-article-list">{matching.map(item=><button type="button" className="hc-article" key={item.id} onClick={()=>openArticle(item.id)}>
          <BookOpen size={18} aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.category} — {item.summary}</small></span><ArrowRight size={16}/></button>)}
          {matching.length===0&&<p className="hc-empty">No matching articles. Try a different search.</p>}</div>
      </div>
    </>}
  </section>
}
