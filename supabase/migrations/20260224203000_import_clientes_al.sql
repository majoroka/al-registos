-- Import inicial de clientes a partir de clientes_AL.csv (43 registos válidos)

begin;

create temporary table tmp_clientes_al_import (
  src_index text not null,
  guest_phone text not null,
  guest_name text not null,
  apartment_name text not null,
  guest_address text not null,
  people_count integer not null,
  linen text not null,
  guest_email text not null,
  year integer not null,
  notes text not null
) on commit drop;

insert into tmp_clientes_al_import (
  src_index,
  guest_phone,
  guest_name,
  apartment_name,
  guest_address,
  people_count,
  linen,
  guest_email,
  year,
  notes
)
values
  ('1', '966596453', 'Ana Patricia Oliveira', 'T2', 'Almeirim', 5, 'Sem Roupa', 'anapopantunes@hotmail.com', 2025, ''),
  ('2', '912613715', 'Tânia Oliveira / Ana Bacelar', 'T2', '', 6, 'Sem Roupa', 'tonyoliveira16@gmail.com', 2025, 'deixou +- limpo   O irmão Diogo já é cliente'),
  ('3', '918310536', 'Mónica Pinto', 'T2', 'Porto', 4, 'Sem Roupa', 'brunomonicapinto@hotmail.com', 2025, 'deixou +- limpo   Já cliente'),
  ('4', '913117760', 'Mónica Maria Clavijo', 'T2', 'Castelo Branco', 3, 'Sem Roupa', 'clavijomonica@hotmail.com', 2025, 'deixou +- limpo   Só ficou uma noite (gata doente)'),
  ('5', '963074318', 'Amadeu Cunha', 'T1', 'Barcelos', 2, 'Com Roupa', 'amadeuvc55@gmail.com', 2025, 'Avaliou com 4'),
  ('6', '966808197', 'Jorge Marques', 'T1', 'Leiria', 4, 'Com Roupa', 'jorgemar@gmail.com', 2025, 'deixou +- limpo'),
  ('7', '964694804', 'Lourdes Portugal', 'T1', '', 3, 'Com Roupa', 'lgportugal1@gmail.com', 2025, 'deixou +- limpo   Já cliente'),
  ('8', '963583615', 'José Clérigo', 'T1', 'Leiria', 4, 'Sem Roupa', 'joseclerigo51@gmail.com', 2025, 'Cancelou (esposa operada as varizes)'),
  ('9', '938043404', 'Anita Barbedo', 'T1', '', 2, 'Sem Roupa', 'anita.barbedo@hotmail.com', 2025, 'deixou +- limpo   OLX'),
  ('10', '967529026', 'António Silva', 'T1', 'Seia', 3, 'Sem Roupa', '', 2025, 'deixou +- limpo   Amigo do Vasco (Pai carolina)'),
  ('11', '966412586', 'Isabel Cristina Silva', 'T1', 'Coimbra', 4, 'Sem Roupa', 'bearike@gmail.com', 2025, 'deixou muito limpo   OLX'),
  ('12', '966232649', 'Lurdes (mãe do Helder)', 'T2', '', 3, '', '', 2024, ''),
  ('13', '963200317', 'Dinis e Rosa Matos', 'T2', 'Guimarães', 5, 'Com Roupa', '', 2024, ''),
  ('14', '962351554', 'Dinis e Rosa Matos', 'T2', 'Guimarães', 5, 'Com Roupa', '', 2024, ''),
  ('15', '918964337', 'Luis Miguel Rufino Reis', 'T2', 'Torres Novas', 4, 'Sem Roupa', 'lureis@sapo.pt', 2024, 'deixou +- limpo'),
  ('15', '918147054', 'Luis Miguel Rufino Reis', 'T2', 'Torres Novas', 4, 'Sem Roupa', 'lureis@sapo.pt', 2024, 'deixou +- limpo'),
  ('16', '918537297', 'Artur Manuel Marques Oliveira', 'T2', 'Porto', 5, 'Sem Roupa', 'am_oliveira@2live.com.pt', 2024, 'deixou +- limpo   Tem um gato'),
  ('17', '912050406', 'Nagla Maria Gomes Nascimento', 'T2', '', 4, 'Sem Roupa', 'deus2398@gmail.com', 2024, 'deixou +- sujo   Perderam umas chaves'),
  ('19', '915651586', 'Idilia Dias / Vitor Costa', 'T2', '', 6, 'Sem Roupa', 'ididias@gmail.com', 2024, 'deixou +- sujo'),
  ('20', '962060168', 'João Amado Caneiro', 'T2', 'Venezuela / Lisboa', 6, 'Sem Roupa', 'joaocaneira3@gmail.com', 2024, 'deixou +- limpo   Passou do T1 para o T2'),
  ('21', '33611903958', 'Américo Gonçalves/Jennifer/Andrea', 'T1', 'França', 4, 'Com Roupa', 'americgoncalves@gmail.com', 2024, 'deixou +- limpo'),
  ('22', '963146771', 'Filipe Quinteiro/Márcia Marques', 'T1', '', 4, 'Com Roupa', 'quinteiro79@gmail.com', 2024, 'deixou muito limpo'),
  ('23', '919076611', 'Filipe Quinteiro/Márcia Marques', 'T1', '', 4, 'Com Roupa', 'quinteiro79@gmail.com', 2024, 'deixou muito limpo'),
  ('24', '41789016424', 'Amilcar Vaz/Vera Vaz', 'T1', 'Suiça/Viseu', 2, 'Sem Roupa', 'verasousavaz@gmail.com', 2024, 'deixou muito limpo   tem uma cadela pequena'),
  ('25', '964379545', 'Alexandre Simões', 'T1', '', 4, 'Com Roupa', 'simoes.amt@gmail.com', 2024, 'deixou muito limpo'),
  ('26', '963583615', 'José Clérigo', 'T1', 'Leiria', 4, 'Sem Roupa', 'jose.clerigo51@gmail.com', 2024, 'deixou +- limpo'),
  ('27', '914510992', 'António Pinto', 'T1', '', 2, 'Com Roupa', 'ajpinto64@gmail.com', 2024, 'deixou +- limpo'),
  ('28', '966635056', 'José Silva', 'T1', 'Lisboa', 3, 'Com Roupa', 'jffs005@gmail.com', 2024, ''),
  ('29', '965132939', 'Carlos Brunhosa Costa', 'T1', '', 2, 'Sem Roupa', 'abrunhosa.costa@gmail.com', 2023, 'deixou +- limpo'),
  ('30', '927788856', 'Fernando Cruz', 'T1', 'Mangualde', 4, 'Sem Roupa', 'fernando.cruz1972@gmail.com', 2023, 'Chegou de manhã e sairam antes na noite'),
  ('31', '967200402', 'Maria Madalena Guerra', 'T1', 'Portalegre', 3, 'Sem Roupa', 'guerra.maria.madalena@gmail.com', 2023, ''),
  ('32', '968627965', 'Inês Nunes / Beatriz Nunes', 'T2', 'Evora', 4, 'Sem Roupa', 'inesjnunes@gmail.com', 2023, 'Bébé de 7 meses'),
  ('33', '910838466', 'Liliana /Manuel Pereira (pai)', 'T2', '', 4, 'Sem Roupa', 'limiss59@gmail.com', 2023, 'deixou +- limpo'),
  ('34', '936228315', 'Diogo Oliveira', 'T2', '', 5, 'Sem Roupa', 'diogo.deco10@hotmail.com', 2023, 'deixou +- limpo   senhora estava grávida'),
  ('35', '918211119', 'Paulo Marques / Sónia Pereira', 'T1', '', 3, '', 'paulo27.mark@gmail.com', 2023, 'deixou muito limpo'),
  ('36', '4,47868E+11', 'Anisah Britton', 'T1', 'UK', 2, 'Com Roupa', 'anisahob@googlemail.com', 2022, 'deixou +- sujo   deixou lixo para levar'),
  ('37', '963621211', 'André Silvestre', 'T1', 'Lisboa', 3, 'Com Roupa', 'afsilvestre@gmail.com', 2022, 'deixou muito limpo'),
  ('38', '961133583', 'Susana Moço', 'T1', '', 4, 'Com Roupa', 'susana.moco@gmail.com', 2022, 'deixou +- limpo'),
  ('40', '910401272', 'Maria Cecília Vicente / Mário faria', 'T1', 'Tomar', 2, 'Com Roupa', 'cecilialcvicente@gmail.com', 2022, 'nota 4 estrelas (sem wifi)'),
  ('41', '939973144', 'António Doutor', 'T1', '', 4, 'Sem Roupa', 'rodolfo.doutor@gmail.com', 2022, 'estragou a pedra das cozinha'),
  ('42', '933645292', 'Teresa Pereiro', 'T1', 'Porto', 3, 'Sem Roupa', '', 2021, 'deixou +- sujo'),
  ('43', '915852537', 'Maria Inês Relvas', 'T1', '', 6, 'Sem Roupa', 'inesrelvas84@gmail.com', 2021, 'deixou +- limpo   2 crianças'),
  ('44', '933853586', 'Lúcia Santos', 'T1', 'Sta Maria Feira', 3, 'Sem Roupa', 'santos.lu484@gmail.com', 2021, 'deixou +- limpo   com lixo no balde')
;

do $$
declare
  expected_count integer := 43;
  source_count integer;
  unmapped_count integer;
  inserted_count integer;
begin
  select count(*) into source_count from tmp_clientes_al_import;

  if source_count <> expected_count then
    raise exception 'Import aborted: expected % rows, got % rows.', expected_count, source_count;
  end if;

  with apartment_map as (
    select distinct on (apartment_key)
      apartment_key,
      id,
      owner_id
    from (
      select
        case
          when upper(replace(name, ' ', '')) like '%T1%' then 'T1'
          when upper(replace(name, ' ', '')) like '%T2%' then 'T2'
          else upper(replace(name, ' ', ''))
        end as apartment_key,
        id,
        owner_id
      from public.apartments
    ) mapped
    order by apartment_key, id
  )
  select count(*) into unmapped_count
  from tmp_clientes_al_import i
  left join apartment_map a
    on upper(replace(i.apartment_name, ' ', '')) = a.apartment_key
  where a.id is null;

  if unmapped_count > 0 then
    raise exception 'Import aborted: % rows have apartment not mapped in public.apartments.', unmapped_count;
  end if;

  with apartment_map as (
    select distinct on (apartment_key)
      apartment_key,
      id,
      owner_id
    from (
      select
        case
          when upper(replace(name, ' ', '')) like '%T1%' then 'T1'
          when upper(replace(name, ' ', '')) like '%T2%' then 'T2'
          else upper(replace(name, ' ', ''))
        end as apartment_key,
        id,
        owner_id
      from public.apartments
    ) mapped
    order by apartment_key, id
  )
  insert into public.stays (
    guest_name,
    guest_phone,
    guest_email,
    guest_address,
    apartment_id,
    people_count,
    nights_count,
    linen,
    rating,
    notes,
    check_in,
    check_out,
    year,
    owner_id
  )
  select
    i.guest_name,
    i.guest_phone,
    i.guest_email,
    i.guest_address,
    a.id,
    i.people_count,
    1,
    nullif(i.linen, ''),
    null,
    nullif(i.notes, ''),
    null,
    null,
    i.year,
    a.owner_id
  from tmp_clientes_al_import i
  join apartment_map a
    on upper(replace(i.apartment_name, ' ', '')) = a.apartment_key;

  get diagnostics inserted_count = row_count;

  if inserted_count <> source_count then
    raise exception 'Import aborted: inserted % rows, expected % rows.', inserted_count, source_count;
  end if;
end
$$;

commit;
