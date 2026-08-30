#!/usr/bin/env python3
import json, os, subprocess, tempfile, unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
SCRIPT=Path(__file__).with_name("run-state")
class TestRunState(unittest.TestCase):
 def setUp(self): self.t=tempfile.TemporaryDirectory(); self.root=Path(self.t.name); self.state=self.root/"state.json"; self.write(self.state,{"schema_version":2,"last_completed_run":None,"last_supplier_id":0,"reviewed_supplier_ids":[],"runs":{}})
 def tearDown(self): self.t.cleanup()
 def write(self,p,v): p=Path(p); p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(v)+"\n")
 def cli(self,*args,env=None):
  e=os.environ.copy(); e.update(env or {}); return subprocess.run([str(SCRIPT),*map(str,args)],text=True,capture_output=True,env=e)
 def make_run(self,date="2026-08-28",ids=(1,2,3,4),plan=None,freeze=True):
  p=self.root/"runs"/f"{date}.json"; self.write(p,{"run_id":date,"status":"running","started_at":f"{date}T03:00:00-05:00","selected_supplier_ids":list(ids),"supplier_results":{}})
  plan=plan or {"batch-a":list(ids[:len(ids)//2]),"batch-b":list(ids[len(ids)//2:])}; pp=self.root/f"plan-{date}.json"; self.write(pp,plan)
  if freeze: self.assertEqual(self.cli("freeze-plan","--run-file",p,"--state-file",self.state,"--batch-plan",pp).returncode,0)
  return p,plan
 def register_import_source(self,p):
  state=json.loads(self.state.read_text()); run=json.loads(p.read_text()); state["runs"][p.stem]={"run_id":p.stem,"status":"running","selected_supplier_ids":run["selected_supplier_ids"]}; self.write(self.state,state)
 def append(self,p,b,s,status="final",extra=None,more=(),env=None):
  f=self.root/f"r-{p.stem}-{b}-{s}-{len(list(self.root.glob('r-*')))}.json"; value={"status":status,"outcome":f"o{s}"}; value.update(extra or {}); self.write(f,value); return self.cli("append","--run-file",p,"--state-file",self.state,"--batch-id",b,"--supplier-id",s,"--result-file",f,*more,env=env)
 def evidence(self,p,count,outcomes=None):
  ids=json.loads(p.read_text())["selected_supplier_ids"]; outcomes=outcomes or {f"o{i}":1 for i in ids}; artifact=self.root/f"reconciliation-{p.stem}.md"; artifact.write_text("read-only reconciliation fixture\n"); import hashlib; artifact_hash=hashlib.sha256(artifact.read_bytes()).hexdigest()
  e=self.root/f"e-{p.stem}.json"; self.write(e,{"verified_at":"2026-08-28T04:00:00-05:00","verified_by":"test","method":"fixture attestation; not live DB truth","selected_count":count,"result_count":count,"sent_email_count":0,"contact_count":0,"sources":[],"source_count":0,"source_active_rows_total":0,"drafts":[],"draft_count":0,"signup_failures":[],"signup_failure_count":0,"outcome_counts":outcomes,"read_only_assertions":{"database_checked":False,"gmail_checked":False,"no_external_actions_performed":True},"reconciliation_artifacts":[{"path":str(artifact),"sha256":artifact_hash}]}); return e
 def fill(self,p,plan,env=None):
  out=[]
  for b,ids in plan.items():
   for s in ids: out.append(self.append(p,b,s,env=env))
  self.assertTrue(all(x.returncode==0 for x in out),[x.stderr for x in out])
 def complete(self,p,count,env=None): return self.cli("merge","--run-file",p,"--state-file",self.state,"--evidence-manifest",self.evidence(p,count),"--complete","--completed-at","2026-08-28T05:00:00-05:00",env=env)
 def test_parallel_append_and_partial_write_loop(self):
  p,plan=self.make_run(); jobs=[(b,s) for b,ids in plan.items() for s in ids]
  with ThreadPoolExecutor(4) as x: rs=list(x.map(lambda z:self.append(p,*z,env={"RUN_STATE_MAX_WRITE":"3"}),jobs))
  self.assertTrue(all(r.returncode==0 for r in rs)); self.assertEqual(self.cli("merge","--run-file",p,"--state-file",self.state).returncode,0); self.assertEqual(len(json.loads(p.read_text())["supplier_results"]),4)
 def test_concurrent_dates_never_regress_cursor(self):
  p1,a=self.make_run("2026-08-28",(1,2)); p2,b=self.make_run("2026-08-29",(3,4)); self.fill(p1,a); self.fill(p2,b)
  with ThreadPoolExecutor(2) as x: rs=list(x.map(lambda z:self.complete(*z),[(p1,2),(p2,2)]))
  self.assertTrue(any(r.returncode==0 for r in rs)); state=json.loads(self.state.read_text()); self.assertEqual(state["last_completed_run"],"2026-08-29"); self.assertEqual(state["last_supplier_id"],4)
 def test_pending_older_completion_is_recovered_before_new_date(self):
  p1,a=self.make_run("2026-08-28",(1,2)); p2,b=self.make_run("2026-08-29",(3,4)); self.fill(p1,a); self.fill(p2,b)
  failed=self.complete(p1,2,env={"RUN_STATE_FAIL_AFTER_RUN_WRITE":"1"}); self.assertNotEqual(failed.returncode,0)
  newer=self.complete(p2,2); self.assertEqual(newer.returncode,0,newer.stderr); state=json.loads(self.state.read_text()); self.assertEqual(set(state["runs"]),{"2026-08-28","2026-08-29"}); self.assertEqual(state["last_completed_run"],"2026-08-29"); self.assertEqual(set(state["reviewed_supplier_ids"]),{1,2,3,4})
  replay=self.complete(p1,2); self.assertEqual(replay.returncode,0,replay.stderr); self.assertEqual(set(json.loads(self.state.read_text())["runs"]),{"2026-08-28","2026-08-29"})
 def test_traversal_unsafe_types_and_orphan_logs_rejected(self):
  p,_=self.make_run(freeze=False); bad=self.root/"bad.json"; self.write(bad,{"../escape":[1,2],"ok":[3,4]}); self.assertNotEqual(self.cli("freeze-plan","--run-file",p,"--state-file",self.state,"--batch-plan",bad).returncode,0)
  p,plan=self.make_run("2026-08-29"); self.fill(p,plan); orphan=p.parent/"batch-results"/p.stem/"old.jsonl"; orphan.write_text("{}\n"); self.assertNotEqual(self.cli("merge","--run-file",p,"--state-file",self.state).returncode,0)
 def test_plan_is_frozen_and_mutation_detected(self):
  p,plan=self.make_run(); self.assertEqual(self.append(p,"batch-a",1).returncode,0); pp=self.root/"changed.json"; self.write(pp,{"renamed":[1,2],"batch-b":[3,4]}); self.assertNotEqual(self.cli("freeze-plan","--run-file",p,"--state-file",self.state,"--batch-plan",pp).returncode,0)
  run=json.loads(p.read_text()); run["batches"]={"renamed":[1,2],"batch-b":[3,4]}; self.write(p,run); response=self.cli("status","--run-file",p,"--state-file",self.state); self.assertNotEqual(response.returncode,0); self.assertIn("batch plan is not frozen or has changed",response.stderr)
 def test_correction_audit_and_latest(self):
  p,_=self.make_run(); first=self.append(p,"batch-a",1); self.assertEqual(first.returncode,0); self.assertNotEqual(self.append(p,"batch-a",1,more=("--correct",)).returncode,0)
  corrected=self.append(p,"batch-a",1,more=("--correct","--reason","evidence correction","--evidence-reference","notes.md#proof")); self.assertEqual(corrected.returncode,0,corrected.stderr); latest=self.cli("latest","--run-file",p,"--state-file",self.state,"--batch-id","batch-a","--supplier-id",1); event=json.loads(latest.stdout)["event"]; self.assertEqual(event["sequence"],2); self.assertTrue(event["correction"]["previous_event_id"]); self.assertEqual(event["correction"]["evidence_reference"],"notes.md#proof")
 def test_completion_replay_stable_and_append_blocked(self):
  p,plan=self.make_run(); self.fill(p,plan); r=self.complete(p,4); self.assertEqual(r.returncode,0,r.stderr); first=json.loads(p.read_text()); r=self.complete(p,4); self.assertEqual(r.returncode,0,r.stderr); second=json.loads(p.read_text()); self.assertEqual(first["completed_at"],second["completed_at"]); self.assertEqual(first["completion_transaction_id"],second["completion_transaction_id"]); self.assertNotEqual(self.append(p,"batch-a",1).returncode,0); self.assertEqual(json.loads(self.state.read_text())["reviewed_supplier_ids"],[1,2,3,4])
 def test_transaction_recovers_after_run_write(self):
  p,plan=self.make_run(); self.fill(p,plan); failed=self.complete(p,4,env={"RUN_STATE_FAIL_AFTER_RUN_WRITE":"1"}); self.assertNotEqual(failed.returncode,0); self.assertEqual(json.loads(p.read_text())["status"],"completed"); self.assertNotIn(p.stem,json.loads(self.state.read_text())["runs"])
  recovered=self.complete(p,4); self.assertEqual(recovered.returncode,0,recovered.stderr); self.assertIn(p.stem,json.loads(self.state.read_text())["runs"]); journals=list((self.state.parent/"run-state-transactions").glob(f"{p.stem}-*.json")); self.assertEqual(len(journals),1); self.assertEqual(json.loads(journals[0].read_text())["phase"],"committed")
 def test_malformed_state_never_completes_run(self):
  p,plan=self.make_run(); self.fill(p,plan); before=p.read_text(); self.state.write_text("{"); r=self.complete(p,4); self.assertNotEqual(r.returncode,0); self.assertEqual(p.read_text(),before)
 def test_recovery_import_exact_coverage_without_actions(self):
  p,_=self.make_run(freeze=False); self.register_import_source(p); plan={"legacy-a":[1,2],"legacy-b":[3,4]}; results={str(i):{"status":"final","outcome":"held"} for i in range(1,5)}; m=self.root/"recovery.json"; self.write(m,{"batches":plan,"results":results}); e=self.evidence(p,4,{"held":4}); command=("import-recovery","--run-file",p,"--state-file",self.state,"--manifest",m,"--evidence-manifest",e,"--imported-at","2026-08-28T06:00:00-05:00"); r=self.cli(*command); self.assertEqual(r.returncode,0,r.stderr); self.assertEqual(json.loads(r.stdout)["actions_performed"],0); replay=self.cli(*command); self.assertEqual(replay.returncode,0,replay.stderr); self.assertTrue(json.loads(replay.stdout)["unchanged"]); self.assertEqual(self.cli("merge","--run-file",p,"--state-file",self.state).returncode,0); self.assertEqual(len(json.loads(p.read_text())["supplier_results"]),4)
 def test_tampered_pending_journal_blocks_every_new_completion(self):
  p1,a=self.make_run("2026-08-28",(1,2)); p2,b=self.make_run("2026-08-29",(3,4)); self.fill(p1,a); self.fill(p2,b); self.assertNotEqual(self.complete(p1,2,env={"RUN_STATE_FAIL_AFTER_RUN_WRITE":"1"}).returncode,0)
  journal=next((self.state.parent/"run-state-transactions").glob("2026-08-28-*.json")); value=json.loads(journal.read_text()); value["delta"]["last_supplier_id"]=999; self.write(journal,value)
  blocked=self.complete(p2,2); self.assertNotEqual(blocked.returncode,0); self.assertNotIn("2026-08-29",json.loads(self.state.read_text())["runs"])
 def test_out_of_order_normal_completion_rejected(self):
  newer,newplan=self.make_run("2026-08-29",(3,4)); older,oldplan=self.make_run("2026-08-28",(1,2)); self.fill(newer,newplan); self.fill(older,oldplan); self.assertEqual(self.complete(newer,2).returncode,0); before=json.loads(self.state.read_text()); rejected=self.complete(older,2); self.assertNotEqual(rejected.returncode,0); after=json.loads(self.state.read_text()); self.assertEqual(after["last_completed_run"],"2026-08-29"); self.assertEqual(after["last_supplier_id"],before["last_supplier_id"])
 def test_symlink_batch_root_rejected(self):
  p,plan=self.make_run(); outside=self.root/"outside"; outside.mkdir(); parent=p.parent/"batch-results"; parent.mkdir(); (parent/p.stem).symlink_to(outside,target_is_directory=True); result=self.append(p,"batch-a",1); self.assertNotEqual(result.returncode,0); self.assertEqual(list(outside.iterdir()),[])
 def test_recovery_rejects_noncanonical_or_extra_keys(self):
  p,_=self.make_run(freeze=False); self.register_import_source(p); plan={"legacy-a":[1,2],"legacy-b":[3,4]}; results={str(i):{"status":"final","outcome":"held"} for i in range(1,5)}; results["01"]={"status":"final","outcome":"held"}; manifest=self.root/"bad-recovery.json"; self.write(manifest,{"batches":plan,"results":results}); evidence=self.evidence(p,4,{"held":4}); response=self.cli("import-recovery","--run-file",p,"--state-file",self.state,"--manifest",manifest,"--evidence-manifest",evidence); self.assertNotEqual(response.returncode,0); self.assertFalse(json.loads(p.read_text()).get("plan_frozen"))
 def test_recovery_import_resumes_each_crash_phase(self):
  for date_value,phase in (("2026-08-28","logs-written"),("2026-08-29","run-frozen")):
   p,_=self.make_run(date_value,(1,2,3,4),freeze=False); self.register_import_source(p); plan={"legacy-a":[1,2],"legacy-b":[3,4]}; results={str(i):{"status":"final","outcome":"held"} for i in range(1,5)}; manifest=self.root/f"recovery-{date_value}.json"; self.write(manifest,{"batches":plan,"results":results}); evidence=self.evidence(p,4,{"held":4}); command=("import-recovery","--run-file",p,"--state-file",self.state,"--manifest",manifest,"--evidence-manifest",evidence,"--imported-at",f"{date_value}T06:00:00-05:00"); failed=self.cli(*command,env={"RUN_STATE_FAIL_IMPORT_PHASE":phase}); self.assertNotEqual(failed.returncode,0); recovered=self.cli(*command); self.assertEqual(recovered.returncode,0,recovered.stderr); self.assertEqual(json.loads(recovered.stdout)["phase"],"committed"); self.assertTrue(json.loads(p.read_text())["plan_frozen"])
 def test_status_exposes_pending_journal_and_blocks_dispatch(self):
  p,plan=self.make_run(); self.fill(p,plan); self.assertNotEqual(self.complete(p,4,env={"RUN_STATE_FAIL_AFTER_RUN_WRITE":"1"}).returncode,0); response=self.cli("status","--run-file",p,"--state-file",self.state); self.assertEqual(response.returncode,0,response.stderr); value=json.loads(response.stdout); self.assertTrue(value["pending_transactions"]); self.assertTrue(value["dispatch_blocked"])
 def test_prepared_transaction_blocks_late_correction_and_stale_merge(self):
  p,plan=self.make_run(); self.fill(p,plan); failed=self.complete(p,4,env={"RUN_STATE_FAIL_AFTER_PREPARE":"1"}); self.assertNotEqual(failed.returncode,0); self.assertEqual(json.loads(p.read_text())["status"],"running")
  correction=self.append(p,"batch-a",1,more=("--correct","--reason","late","--evidence-reference","late.md")); self.assertNotEqual(correction.returncode,0); self.assertEqual(json.loads(p.read_text())["status"],"completed")
  stale_merge=self.cli("merge","--run-file",p,"--state-file",self.state); self.assertNotEqual(stale_merge.returncode,0); replay=self.complete(p,4); self.assertEqual(replay.returncode,0,replay.stderr); self.assertEqual(json.loads(p.read_text())["supplier_results"]["1"]["outcome"],"o1")
 def test_completed_status_rejects_late_log_divergence(self):
  import hashlib
  p,plan=self.make_run(); self.fill(p,plan); self.assertEqual(self.complete(p,4).returncode,0); log=p.parent/"batch-results"/p.stem/"batch-a.jsonl"; events=[json.loads(line) for line in log.read_text().splitlines()]; previous=events[0]; event={"run_id":p.stem,"plan_id":previous["plan_id"],"batch_id":"batch-a","supplier_id":1,"sequence":2,"recorded_at":"2026-08-28T06:00:00-05:00","result":{"status":"final","outcome":"late"},"correction":{"previous_event_id":previous["event_id"],"reason":"manual tamper","evidence_reference":"tamper.md"}}; event["event_id"]=hashlib.sha256(json.dumps(event,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest(); log.write_text(log.read_text()+json.dumps(event,sort_keys=True,separators=(",",":"))+"\n"); status=self.cli("status","--run-file",p,"--state-file",self.state); self.assertNotEqual(status.returncode,0)
 def test_semantically_tampered_delta_and_invalid_state_schema_block(self):
  import hashlib
  p,plan=self.make_run(); self.fill(p,plan); self.assertNotEqual(self.complete(p,4,env={"RUN_STATE_FAIL_AFTER_PREPARE":"1"}).returncode,0); journal=next((self.state.parent/"run-state-transactions").glob("*.json")); value=json.loads(journal.read_text()); value["delta"]["reviewed_supplier_ids"]=[4,3,2,1]; body={k:v for k,v in value.items() if k!="journal_hash"}; value["journal_hash"]=hashlib.sha256(json.dumps(body,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest(); self.write(journal,value); blocked=self.complete(p,4); self.assertNotEqual(blocked.returncode,0)
  root2=self.root/"invalid-state"; bad=root2/"state.json"; self.write(bad,{"schema_version":2,"runs":[],"reviewed_supplier_ids":[]}); run=root2/"runs"/"2026-09-01.json"; self.write(run,{"run_id":"2026-09-01","status":"running","started_at":"2026-09-01T03:00:00-05:00","selected_supplier_ids":[1],"supplier_results":{}}); planfile=root2/"plan.json"; self.write(planfile,{"b":[1]}); self.assertNotEqual(self.cli("freeze-plan","--run-file",run,"--state-file",bad,"--batch-plan",planfile).returncode,0)
 def test_preopen_deleted_inode_race_is_rejected(self):
  import fcntl,importlib.machinery
  module=importlib.machinery.SourceFileLoader("run_state_race_test",str(SCRIPT)).load_module(); lock=self.root/"race.lock"; fd=os.open(lock,os.O_RDWR|os.O_CREAT,0o600); os.fchmod(fd,0o600); fcntl.flock(fd,fcntl.LOCK_EX); calls=[0]
  def race(path):
   calls[0]+=1
   if calls[0]==1: Path(path).unlink()
   return False
  module.deleted_lock_inode_exists=race
  try:
   with self.assertRaises(ValueError): module.locked(lock)
  finally: os.close(fd)
 def test_semantic_run_date_substitution_and_journal_name_mismatch_rejected(self):
  import hashlib
  p,plan=self.make_run(); self.fill(p,plan); self.assertNotEqual(self.complete(p,4,env={"RUN_STATE_FAIL_AFTER_PREPARE":"1"}).returncode,0); journal=next((self.state.parent/"run-state-transactions").glob("*.json")); value=json.loads(journal.read_text()); fake="2026-08-29"; value["transaction_core"]["run_id"]=fake; value["delta"]["run_id"]=fake; value["delta"]["completed_run"]["run_id"]=fake; keys=("run_id","run_file","state_file","plan_id","result_hash","supplier_results_hash","evidence_hash","canonical_running_run_hash"); identity={k:value["transaction_core"][k] for k in keys}; tx=hashlib.sha256(json.dumps(identity,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest(); value["transaction_id"]=tx; value["delta"]["completed_run"]["completion_transaction_id"]=tx; value["delta"]["completed_run_hash"]=hashlib.sha256(json.dumps(value["delta"]["completed_run"],sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest(); value["transaction_core"]["completed_run_hash"]=value["delta"]["completed_run_hash"]; body={k:v for k,v in value.items() if k!="journal_hash"}; value["journal_hash"]=hashlib.sha256(json.dumps(body,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest(); self.write(journal,value); self.assertNotEqual(self.complete(p,4).returncode,0); self.assertNotEqual(self.cli("status","--run-file",p,"--state-file",self.state).returncode,0); self.assertEqual(json.loads(self.state.read_text())["runs"],{})
 def test_replaced_lock_inode_is_rejected(self):
  import fcntl
  p,plan=self.make_run(); self.fill(p,plan); lock=self.state.parent/".daily-onboarding-state.lock"; held=open(lock,"a+"); fcntl.flock(held,fcntl.LOCK_EX); lock.unlink()
  try: response=self.cli("latest","--run-file",p,"--state-file",self.state,"--batch-id","batch-a","--supplier-id",1); self.assertNotEqual(response.returncode,0); self.assertIn("replaced lock inode",response.stderr)
  finally: held.close()
 def test_legacy_state_run_ids_migrate_once(self):
  old=self.root/"legacy-state.json"; self.write(old,{"schema_version":2,"last_completed_run":"2026-08-27","last_supplier_id":2,"reviewed_supplier_ids":[1,2],"runs":{"2026-08-27":{"status":"completed","selected_supplier_ids":[1,2]}}}); standalone=self.root/"runs"/"2026-08-27.json"; self.write(standalone,{"status":"completed","started_at":"2026-08-27T03:00:00-05:00","selected_supplier_ids":[1,2],"supplier_results":{"1":{"status":"final","outcome":"held"},"2":{"status":"final","outcome":"held"}}}); first=self.cli("migrate-state-run-ids","--state-file",old); self.assertEqual(first.returncode,0,first.stderr); self.assertEqual(json.loads(old.read_text())["runs"]["2026-08-27"]["run_id"],"2026-08-27"); migrated=json.loads(standalone.read_text()); self.assertEqual(migrated["run_id"],"2026-08-27"); self.assertTrue(migrated["legacy_completed"]); status=self.cli("status","--run-file",standalone,"--state-file",old); self.assertEqual(status.returncode,0,status.stderr); self.assertFalse(json.loads(status.stdout)["dispatch_blocked"]); second=self.cli("migrate-state-run-ids","--state-file",old); self.assertEqual(second.returncode,0,second.stderr); self.assertFalse(json.loads(second.stdout)["changed"])
 def import_fixture(self,date_value="2026-08-27"):
  p,_=self.make_run(date_value,freeze=False); self.register_import_source(p); manifest=self.root/f"{date_value}-import.json"; self.write(manifest,{"batches":{"legacy-a":[1,2],"legacy-b":[3,4]},"results":{str(i):{"status":"final","outcome":"held"} for i in range(1,5)}}); evidence=self.evidence(p,4,{"held":4}); return p,manifest,evidence
 def test_import_replays_replace_before_phase_update_window(self):
  import importlib.machinery
  module=importlib.machinery.SourceFileLoader("replace_window_test",str(SCRIPT)).load_module(); p,manifest,evidence=self.import_fixture(); module.ensure_import_authorization(self.state,p.stem,manifest,evidence,create=True); core=module.import_journal_core(p,self.state,manifest,evidence,"2026-08-28T06:00:00-05:00"); directory=module.transaction_dirs(self.state)[1]; journal=directory/f'{p.stem}-{core["transaction_id"]}.json'; module.atomic_json(journal,module.journal_with_hash(core,"prepared")); root=p.parent/"batch-results"/p.stem; root.mkdir(parents=True)
  for batch,text in core["batch_lines"].items(): (root/f"{batch}.jsonl").write_text(text)
  result=module.advance_import(journal,manifest,evidence,self.state,allow_injection=False); self.assertEqual(result["phase"],"committed")
 def test_import_replays_frozen_run_before_phase_update_window(self):
  import importlib.machinery
  module=importlib.machinery.SourceFileLoader("frozen_window_test",str(SCRIPT)).load_module(); p,manifest,evidence=self.import_fixture(); module.ensure_import_authorization(self.state,p.stem,manifest,evidence,create=True); core=module.import_journal_core(p,self.state,manifest,evidence,"2026-08-28T06:00:00-05:00"); directory=module.transaction_dirs(self.state)[1]; journal=directory/f'{p.stem}-{core["transaction_id"]}.json'; root=p.parent/"batch-results"/p.stem; root.mkdir(parents=True)
  for batch,text in core["batch_lines"].items(): (root/f"{batch}.jsonl").write_text(text)
  module.atomic_json(p,core["frozen_run"]); module.atomic_json(journal,module.journal_with_hash(core,"logs-written")); result=module.advance_import(journal,manifest,evidence,self.state,allow_injection=False); self.assertEqual(result["phase"],"committed")
 def test_committed_replay_rejects_missing_changed_or_extra_physical_logs(self):
  for offset,variant in enumerate(("missing","changed","extra"),28):
   date_value=f"2026-08-{offset}"; p,manifest,evidence=self.import_fixture(date_value); command=("import-recovery","--run-file",p,"--state-file",self.state,"--manifest",manifest,"--evidence-manifest",evidence,"--imported-at","2026-08-28T06:00:00-05:00"); self.assertEqual(self.cli(*command).returncode,0); root=p.parent/"batch-results"/p.stem
   if variant=="missing": (root/"legacy-a.jsonl").unlink()
   elif variant=="changed": (root/"legacy-a.jsonl").write_text("changed\n")
   else: (root/"extra.jsonl").write_text("extra\n")
   with self.subTest(variant=variant): self.assertNotEqual(self.cli(*command).returncode,0)
 def test_import_evidence_change_blocks_partial_replay(self):
  p,_=self.make_run(freeze=False); self.register_import_source(p); manifest=self.root/"evidence-manifest-source.json"; self.write(manifest,{"batches":{"legacy":[1,2,3,4]},"results":{str(i):{"status":"final","outcome":"held"} for i in range(1,5)}}); evidence=self.evidence(p,4,{"held":4}); command=("import-recovery","--run-file",p,"--state-file",self.state,"--manifest",manifest,"--evidence-manifest",evidence,"--imported-at","2026-08-28T06:00:00-05:00"); self.assertNotEqual(self.cli(*command,env={"RUN_STATE_FAIL_IMPORT_PHASE":"run-frozen"}).returncode,0); changed=json.loads(evidence.read_text()); changed["method"]="substituted"; self.write(evidence,changed); self.assertNotEqual(self.cli(*command).returncode,0)
 def test_import_path_substitution_blocks_partial_replay(self):
  p,_=self.make_run(freeze=False); self.register_import_source(p); manifest=self.root/"bound-manifest.json"; self.write(manifest,{"batches":{"legacy":[1,2,3,4]},"results":{str(i):{"status":"final","outcome":"held"} for i in range(1,5)}}); evidence=self.evidence(p,4,{"held":4}); command=("import-recovery","--run-file",p,"--state-file",self.state,"--manifest",manifest,"--evidence-manifest",evidence,"--imported-at","2026-08-28T06:00:00-05:00"); self.assertNotEqual(self.cli(*command,env={"RUN_STATE_FAIL_IMPORT_PHASE":"logs-written"}).returncode,0); alternate=self.root/"alternate-manifest.json"; alternate.write_bytes(manifest.read_bytes()); substituted=("import-recovery","--run-file",p,"--state-file",self.state,"--manifest",alternate,"--evidence-manifest",evidence); self.assertNotEqual(self.cli(*substituted).returncode,0)
 def test_import_semantic_cohort_substitution_rejected_from_canonical_sources(self):
  import importlib.machinery,hashlib
  module=importlib.machinery.SourceFileLoader("import_tamper_test",str(SCRIPT)).load_module(); p,_=self.make_run(freeze=False); self.register_import_source(p); manifest=self.root/"import-manifest.json"; self.write(manifest,{"batches":{"legacy":[1,2,3,4]},"results":{str(i):{"status":"final","outcome":"held"} for i in range(1,5)}}); evidence=self.evidence(p,4,{"held":4}); module.ensure_import_authorization(self.state,p.stem,manifest,evidence,create=True); core=module.import_journal_core(p,self.state,manifest,evidence,"2026-08-28T06:00:00-05:00"); fake=999; plan={"legacy":[fake]}; plan_id=module.validate_plan([fake],plan); frozen=dict(core["frozen_run"]); frozen["selected_supplier_ids"]=[fake]; frozen["batches"]=plan; frozen["plan_id"]=plan_id; event={"run_id":p.stem,"plan_id":plan_id,"batch_id":"legacy","supplier_id":fake,"sequence":1,"recorded_at":"2026-08-28T06:00:00-05:00","result":{"status":"final","outcome":"held"},"recovery_evidence_reference":str(manifest)}; event["event_id"]=module.sha(event); lines={"legacy":module.canonical(event)+"\n"}; core["frozen_run"]=frozen; core["batch_lines"]=lines; transaction=core["transaction_core"]; transaction["selected_supplier_ids"]=[fake]; transaction["plan_id"]=plan_id; transaction["frozen_run_hash"]=module.sha(frozen); transaction["batch_lines_hash"]=module.sha(lines); core["transaction_id"]=module.sha(transaction); directory=module.transaction_dirs(self.state)[1]; journal=directory/f'{p.stem}-{core["transaction_id"]}.json'; module.atomic_json(journal,module.journal_with_hash(core,"prepared"));
  with self.assertRaises(ValueError): module.advance_import(journal,manifest,evidence,self.state,allow_injection=False)
  self.assertEqual(json.loads(p.read_text())["selected_supplier_ids"],[1,2,3,4])
 def test_import_manifest_or_evidence_change_blocks_partial_replay(self):
  p,_=self.make_run(freeze=False); self.register_import_source(p); manifest=self.root/"partial-manifest.json"; self.write(manifest,{"batches":{"legacy":[1,2,3,4]},"results":{str(i):{"status":"final","outcome":"held"} for i in range(1,5)}}); evidence=self.evidence(p,4,{"held":4}); command=("import-recovery","--run-file",p,"--state-file",self.state,"--manifest",manifest,"--evidence-manifest",evidence,"--imported-at","2026-08-28T06:00:00-05:00"); self.assertNotEqual(self.cli(*command,env={"RUN_STATE_FAIL_IMPORT_PHASE":"logs-written"}).returncode,0); changed=json.loads(manifest.read_text()); changed["results"]["1"]["outcome"]="substituted"; self.write(manifest,changed); self.assertNotEqual(self.cli(*command).returncode,0)
 def test_bad_evidence_blocks_completion(self):
  p,plan=self.make_run(); self.fill(p,plan); e=self.evidence(p,4); v=json.loads(e.read_text()); v["sent_email_count"]=1; self.write(e,v); before=p.read_text(); r=self.cli("merge","--run-file",p,"--state-file",self.state,"--evidence-manifest",e,"--complete"); self.assertNotEqual(r.returncode,0); self.assertEqual(p.read_text(),before)
if __name__=="__main__":
 suite=unittest.defaultTestLoader.loadTestsFromTestCase(TestRunState)
 result=unittest.TextTestRunner(verbosity=2).run(suite)
 raise SystemExit(0 if result.wasSuccessful() else 1)
