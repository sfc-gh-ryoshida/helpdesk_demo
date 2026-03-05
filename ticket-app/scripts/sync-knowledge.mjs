const knowledgeArticles = [
  { kb_id: "KB001", category: "HARDWARE", subcategory: "スキャナー", question: "スキャナーの電源が入らない", answer: "バッテリー切れまたはバッテリー劣化の可能性があります。充電器に30分以上接続してから再度電源を入れてください。それでも起動しない場合はバッテリー交換が必要です。", keywords: "スキャナー,電源,入らない,起動しない,バッテリー,充電", steps: ["1. 充電器に接続して30分待つ","2. 電源ボタンを5秒長押し","3. バッテリーを一度外して再装着","4. 改善しない場合はヘルプデスクへ連絡"] },
  { kb_id: "KB002", category: "HARDWARE", subcategory: "スキャナー", question: "スキャナーの画面が割れた", answer: "画面破損は修理または交換が必要です。現在の作業を中断し、代替機を手配します。破損したスキャナーのアセットIDをお知らせください。", keywords: "スキャナー,画面,割れた,破損,ひび,故障,落とした", steps: ["1. 破損機のアセットIDを確認","2. 代替機を手配します","3. 破損機は回収します","4. データ移行が必要な場合はお知らせください"] },
  { kb_id: "KB003", category: "HARDWARE", subcategory: "スキャナー", question: "スキャナーでバーコードが読み取れない", answer: "レンズの汚れ、バーコードの印刷品質、または読み取り距離が原因の可能性があります。まずレンズを柔らかい布で拭いてください。", keywords: "スキャナー,バーコード,読み取れない,スキャンできない,認識しない", steps: ["1. レンズを柔らかい布で拭く","2. バーコードラベルの状態を確認","3. 読み取り距離を10-30cmに調整","4. 別のバーコードで試す","5. 改善しない場合は設定リセット"] },
  { kb_id: "KB004", category: "HARDWARE", subcategory: "スキャナー", question: "スキャナーのバッテリーがすぐ切れる", answer: "バッテリーの劣化が考えられます。使用頻度が高い場合、1-2年で交換時期になります。予備バッテリーの手配または本体交換を検討します。", keywords: "スキャナー,バッテリー,すぐ切れる,持たない,消耗,劣化", steps: ["1. 使用していないアプリを終了","2. 画面の明るさを下げる","3. WiFi接続を必要時のみONにする","4. 予備バッテリーを申請"] },
  { kb_id: "KB005", category: "HARDWARE", subcategory: "スキャナー", question: "スキャナーがフリーズして動かない", answer: "メモリ不足やアプリケーションの不具合でフリーズすることがあります。強制再起動を試してください。", keywords: "スキャナー,フリーズ,固まった,動かない,反応しない,止まった", steps: ["1. 電源ボタンを10秒長押しで強制終了","2. 30秒待ってから電源ON","3. 頻発する場合はアプリのキャッシュクリア","4. 改善しない場合は初期化を検討"] },
  { kb_id: "KB020", category: "HARDWARE", subcategory: "プリンター", question: "プリンターで印刷できない", answer: "プリンターの電源、用紙、接続状態を確認してください。よくある原因は用紙切れとオフライン状態です。", keywords: "プリンター,印刷,できない,出ない,プリントできない", steps: ["1. プリンターの電源を確認","2. 用紙とインク/トナーを確認","3. PCとの接続を確認","4. プリンターをオンラインに設定","5. PCとプリンターを再起動"] },
  { kb_id: "KB030", category: "HARDWARE", subcategory: "PC", question: "パソコンの電源が入らない", answer: "電源ケーブルの接続、電源タップのスイッチ、バッテリー（ノートPC）を確認してください。", keywords: "パソコン,PC,電源,入らない,起動しない", steps: ["1. 電源ケーブルがコンセントに刺さっているか確認","2. 電源タップのスイッチを確認","3. 別のコンセントで試す","4. ノートPCはバッテリーを外してAC電源で起動","5. 改善しない場合は修理依頼"] },
  { kb_id: "KB040", category: "SOFTWARE", subcategory: "WMS", question: "WMSにログインできない", answer: "パスワード間違い、有効期限切れ、またはアカウントロックの可能性があります。", keywords: "WMS,ログイン,できない,入れない,パスワード", steps: ["1. ユーザーIDとパスワードを確認","2. Caps Lockがオフか確認","3. パスワードリセットを試す","4. アカウントロックの場合は30分待つか解除依頼"] },
  { kb_id: "KB060", category: "SOFTWARE", subcategory: "メール", question: "メールが送受信できない", answer: "ネットワーク接続とメール設定を確認してください。サーバー障害の可能性もあります。", keywords: "メール,送信,受信,できない,届かない", steps: ["1. ネットワーク接続を確認","2. Outlookを再起動","3. 送受信ボタンを手動でクリック","4. メールサーバー設定を確認","5. 全社的な障害でないか確認"] },
  { kb_id: "KB064", category: "SOFTWARE", subcategory: "Teams", question: "Teamsで通話ができない", answer: "マイクとスピーカーの設定を確認してください。デバイスの選択が正しいか確認が必要です。", keywords: "Teams,通話,できない,音声,聞こえない", steps: ["1. Teamsの設定→デバイスを開く","2. マイクとスピーカーを正しく選択","3. テスト通話を実行","4. PCのサウンド設定を確認","5. Teamsを再起動"] },
  { kb_id: "KB066", category: "SOFTWARE", subcategory: "VPN", question: "VPNに接続できない", answer: "VPNクライアントの設定と認証情報を確認してください。インターネット接続も確認が必要です。", keywords: "VPN,接続,できない,リモート,在宅", steps: ["1. インターネット接続を確認","2. VPNクライアントを再起動","3. ユーザーIDとパスワードを確認","4. VPNクライアントを最新版に更新","5. ファイアウォール設定を確認"] },
  { kb_id: "KB070", category: "ACCOUNT", subcategory: "パスワード", question: "パスワードを忘れた", answer: "パスワードリセットは社内ポータルから自分で実行できます。", keywords: "パスワード,忘れた,わからない,リセット", steps: ["1. 社内ポータルにアクセス","2. パスワードをお忘れの方をクリック","3. ユーザーIDを入力","4. 登録メールアドレスにリセットリンクが届く","5. リンクから新しいパスワードを設定"] },
  { kb_id: "KB072", category: "ACCOUNT", subcategory: "ロック", question: "アカウントがロックされた", answer: "パスワードを複数回間違えるとアカウントがロックされます。30分後に自動解除されます。", keywords: "アカウント,ロック,ロックされた,解除", steps: ["1. 30分待って再試行","2. 急ぎの場合はヘルプデスクに連絡","3. ロック解除後はパスワードを正確に入力","4. パスワードがわからない場合はリセット"] },
  { kb_id: "KB079", category: "ACCOUNT", subcategory: "二要素認証", question: "二要素認証を設定したい", answer: "二要素認証の設定方法をご案内します。セキュリティ強化のため設定を推奨します。", keywords: "二要素認証,2FA,認証,セキュリティ", steps: ["1. 社内ポータルにログイン","2. セキュリティ設定を開く","3. 二要素認証を有効化","4. 認証アプリでQRコードをスキャン","5. 確認コードを入力して完了"] },
  { kb_id: "KB090", category: "NETWORK", subcategory: "WiFi", question: "WiFiに接続できない", answer: "倉庫内のWiFiはエリアによって電波状況が異なります。接続設定を確認してください。", keywords: "WiFi,接続,できない,無線,ネットワーク", steps: ["1. WiFiをOFF→ONにする","2. 端末を再起動","3. 正しいSSIDを選択しているか確認","4. パスワードを再入力","5. 別のエリアで試す"] },
  { kb_id: "KB098", category: "NETWORK", subcategory: "共有フォルダ", question: "共有フォルダにアクセスできない", answer: "共有フォルダへのアクセス権限を確認してください。権限がない場合は申請が必要です。", keywords: "共有,フォルダ,アクセス,できない,見れない", steps: ["1. ネットワーク接続を確認","2. 正しいパスを入力しているか確認","3. アクセス権限を確認","4. 権限がない場合は管理者に申請","5. PCを再起動して試す"] },
  { kb_id: "KB103", category: "OTHER", subcategory: "セキュリティ", question: "不審なメールを受信した", answer: "不審なメールは開かずに、セキュリティ部門に報告してください。", keywords: "不審,メール,フィッシング,詐欺,スパム", steps: ["1. メールを開かない・リンクをクリックしない","2. 添付ファイルを開かない","3. セキュリティ部門に報告","4. メールを削除しない（調査用）"] },
  { kb_id: "KB114", category: "OTHER", subcategory: "ヘルプデスク", question: "ヘルプデスクの営業時間を知りたい", answer: "ヘルプデスクの営業時間と連絡先をご案内します。", keywords: "ヘルプデスク,営業時間,連絡先,問い合わせ", steps: ["営業時間：平日 8:00-18:00","緊急時：セキュリティ部門に連絡","連絡方法：Slack #ryoshida_demo_helpdesk-request または内線1234"] },
  { kb_id: "KB200", category: "SOFTWARE", subcategory: "配送アプリ", question: "配送アプリにログインできない", answer: "ドライバーIDとパスワードを確認してください。パスワードは初期設定から変更していない場合、社員番号の下4桁です。", keywords: "配送アプリ,ログイン,できない,入れない,ドライバー", steps: ["1. ドライバーIDを確認（社員番号）","2. パスワードを確認","3. アプリを再起動","4. それでもダメなら配車センターに連絡"] },
  { kb_id: "KB240", category: "HARDWARE", subcategory: "車両", question: "車のエンジンがかからない", answer: "バッテリー上がりの可能性があります。他の車両でジャンプスタートを試すか、ロードサービスを呼んでください。", keywords: "車,エンジン,かからない,動かない,バッテリー", steps: ["1. 配車センターに連絡","2. 近くにいる同僚にジャンプスタートを依頼","3. ロードサービスを手配","4. 配送は他のドライバーに引き継ぎ"] },
  { kb_id: "KB253", category: "HARDWARE", subcategory: "車両", question: "事故を起こした", answer: "事故発生時は冷静に対応してください。けが人の救護を最優先します。", keywords: "車,事故,ぶつけた,衝突,接触", steps: ["1. けが人がいれば119番","2. 警察に連絡（110番）","3. 配車センターに連絡","4. 相手の連絡先と保険情報を交換","5. 写真を撮影"] },
  { kb_id: "KB280", category: "OTHER", subcategory: "業務", question: "配送先が不在だった", answer: "不在時の対応手順をご案内します。", keywords: "不在,いない,留守,対応,再配達", steps: ["1. インターホンで呼び出し（2回）","2. 電話連絡を試みる","3. 不在票を投函","4. アプリで不在登録","5. 荷物は持ち帰り"] },
  { kb_id: "KB300", category: "OTHER", subcategory: "安全", question: "急病人を発見した", answer: "急病人への対応手順をご案内します。", keywords: "急病人,倒れている,意識,救急", steps: ["1. 安全を確保","2. 意識と呼吸を確認","3. 119番通報","4. AEDがあれば使用","5. 配車センターに報告"] },
  { kb_id: "KB303", category: "OTHER", subcategory: "安全", question: "熱中症の症状が出た", answer: "熱中症の初期対応をご案内します。", keywords: "熱中症,暑い,めまい,気分悪い", steps: ["1. 涼しい場所に移動","2. 水分・塩分を補給","3. 体を冷やす","4. 症状が重い場合は119番","5. 配車センターに報告"] },
];

async function clearAndSeed() {
  // Delete all existing
  const existing = await fetch("http://localhost:3001/api/knowledge").then(r => r.json());
  console.log(`Deleting ${existing.length} existing articles...`);
  
  for (const article of existing) {
    await fetch(`http://localhost:3001/api/knowledge?id=${article.id}`, { method: "DELETE" });
  }
  console.log("Deleted existing articles");

  // Insert new
  console.log(`\nInserting ${knowledgeArticles.length} articles from Snowflake...`);
  
  for (const kb of knowledgeArticles) {
    const content = `【回答】\n${kb.answer}\n\n【解決手順】\n${kb.steps.join('\n')}`;
    const article = {
      title: kb.question,
      content: content,
      category: kb.category,
      tags: kb.keywords,
      author: "ヘルプデスク"
    };
    
    const res = await fetch("http://localhost:3001/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(article),
    });
    
    if (res.ok) {
      console.log(`✓ ${kb.kb_id}: ${kb.question}`);
    } else {
      console.log(`✗ ${kb.kb_id}: Failed`);
    }
  }
  
  console.log("\nDone! Synced representative articles from Snowflake KNOWLEDGE_BASE");
}

clearAndSeed();
