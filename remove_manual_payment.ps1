$files = @(
'c:\Users\hp\Music\tucks again\clothes\bubu.html',
'c:\Users\hp\Music\tucks again\clothes\cshirts.html',
'c:\Users\hp\Music\tucks again\clothes\gowns.html',
'c:\Users\hp\Music\tucks again\clothes\shirts.html',
'c:\Users\hp\Music\tucks again\clothes\skirts.html',
'c:\Users\hp\Music\tucks again\clothes\trousers.html',
'c:\Users\hp\Music\tucks again\footwear\loafers.html',
'c:\Users\hp\Music\tucks again\footwear\slides.html',
'c:\Users\hp\Music\tucks again\footwear\sneakers.html',
'c:\Users\hp\Music\tucks again\gadgets\accessoriesGadgets.html',
'c:\Users\hp\Music\tucks again\gadgets\laptops.html',
'c:\Users\hp\Music\tucks again\gadgets\phones.html',
'c:\Users\hp\Music\tucks again\hairessentials\hairProducts.html',
'c:\Users\hp\Music\tucks again\jewelry\accessoriesJewelry.html',
'c:\Users\hp\Music\tucks again\jewelry\bracelets.html',
'c:\Users\hp\Music\tucks again\jewelry\chains.html',
'c:\Users\hp\Music\tucks again\jewelry\matchingSets.html',
'c:\Users\hp\Music\tucks again\jewelry\rings.html',
'c:\Users\hp\Music\tucks again\jewelry\watches.html',
'c:\Users\hp\Music\tucks again\skin\skinCare.html',
'c:\Users\hp\Music\tucks again\thrift\thrift.html'
)

foreach ($file in $files) {
    if (-not (Test-Path $file)) { Write-Host "MISSING: $file"; continue }
    $text = Get-Content -Raw -LiteralPath $file
    $orig = $text

    $text = [regex]::Replace($text, '(?s)\s*<div id="uploadModal" class="modal" aria-hidden="true">.*?</div>\s*</div>\s*', '', 'Singleline')
    $text = [regex]::Replace($text, '(?s)\s*const uploadModal = document\.getElementById\(\'uploadModal\'\);.*?const uploadPreviewName = document\.getElementById\(\'uploadPreviewName\'\);\s*', '', 'Singleline')
    $text = [regex]::Replace($text, '(?s)\s*if \(buyBtn\) \{.*?showModal\(uploadModal\);.*?\}\s*', '', 'Singleline')
    $text = [regex]::Replace($text, '(?s)\s*uploadFile\.addEventListener\(\'change\'\,.*?\}\);\s*', '', 'Singleline')
    $text = [regex]::Replace($text, '(?s)\s*async function uploadToCloudinary\(file\) \{.*?return res\.json\(\);\s*\}\s*', '', 'Singleline')
    $text = [regex]::Replace($text, '(?s)\s*async function createOrderRecord\(data\) \{.*?return docRef\.id;\s*\}\s*', '', 'Singleline')
    $text = [regex]::Replace($text, '(?s)\s*submitUpload\.addEventListener\(\'click\'\,.*?\}\);\s*', '', 'Singleline')
    $text = [regex]::Replace($text, '\s*closeUpload\.addEventListener\(\'click\'\,.*?\);\s*', '', 'Singleline')
    $text = [regex]::Replace($text, '\s*cancelUpload\.addEventListener\(\'click\'\,.*?\);\s*', '', 'Singleline')
    $text = [regex]::Replace($text, '(?s)\s*uploadModal\.addEventListener\(\'transitionend\'\,.*?\}\);\s*', '', 'Singleline')

    if ($text -ne $orig) {
        Set-Content -LiteralPath $file -Value $text -Encoding utf8
        Write-Host "PATCHED: $file"
    } else {
        Write-Host "UNCHANGED: $file"
    }
}
